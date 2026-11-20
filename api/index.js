const crypto = require('crypto');

// ============================================================================
// 1. CRIPTOGRAFIA E SESSÃO (Cookie HttpOnly + AES-256-GCM)
// ============================================================================
const COOKIE_NAME = 'gofisio_session';
const STATE_COOKIE_NAME = 'gofisio_oauth_state';
const RETURN_TO_COOKIE_NAME = 'gofisio_return_to';

function sanitizeReturnTo(raw) {
    if (typeof raw !== 'string') return '/fechamento';
    const trimmed = raw.trim();
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/fechamento';
    return trimmed;
}

function getSecretKey() {
    const rawSecret = process.env.SESSION_SECRET || process.env.GOOGLE_CLIENT_SECRET || 'default-dev-secret-change-in-prod';
    return crypto.createHash('sha256').update(String(rawSecret)).digest();
}

function encryptSession(data) {
    const iv = crypto.randomBytes(12);
    const key = getSecretKey();
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const json = JSON.stringify(data);
    const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptSession(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
        const iv = Buffer.from(parts[0], 'base64url');
        const tag = Buffer.from(parts[1], 'base64url');
        const encrypted = Buffer.from(parts[2], 'base64url');
        const key = getSecretKey();
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return JSON.parse(decrypted.toString('utf8'));
    } catch (err) {
        return null;
    }
}

function parseCookies(req) {
    const list = {};
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return list;
    cookieHeader.split(';').forEach(cookie => {
        let [name, ...rest] = cookie.split('=');
        name = name?.trim();
        if (!name) return;
        const value = rest.join('=').trim();
        if (!value) return;
        list[name] = decodeURIComponent(value);
    });
    return list;
}

function serializeCookie(name, value, options = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`];
    if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
    if (options.path) parts.push(`Path=${options.path}`);
    if (options.httpOnly) parts.push('HttpOnly');
    if (options.secure) parts.push('Secure');
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
    return parts.join('; ');
}

function getBaseUrl(req) {
    const rawHost = req.headers['x-forwarded-host'] || req.headers.host;
    if (rawHost) {
        const host = String(rawHost).split(',')[0].trim();
        const rawProto = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
        const proto = String(rawProto).split(',')[0].trim();
        return `${proto}://${host}`;
    }
    if (process.env.APP_BASE_URL) {
        return process.env.APP_BASE_URL.replace(/\/$/, '');
    }
    return 'http://localhost:3000';
}

function isSecureRequest(req) {
    const proto = req.headers['x-forwarded-proto'] || '';
    return proto.includes('https') || process.env.NODE_ENV === 'production';
}

function clearSessionCookie(req, res) {
    const secure = isSecureRequest(req);
    res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, '', {
        httpOnly: true,
        secure,
        sameSite: 'Lax',
        path: '/',
        maxAge: 0
    }));
}

function createGoogleApiError(message, status) {
    const err = new Error(message);
    err.statusCode = status;
    err.isGoogleAuthError = status === 401;
    return err;
}

async function refreshGoogleSession(req, res, session) {
    if (!session || !session.refreshToken) return null;
    try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID || '',
                client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
                refresh_token: session.refreshToken,
                grant_type: 'refresh_token'
            }).toString()
        });
        if (!tokenRes.ok) {
            return null;
        }
        const tokenData = await tokenRes.json();
        const updated = {
            ...session,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token || session.refreshToken,
            expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000
        };
        const secure = isSecureRequest(req);
        res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, encryptSession(updated), {
            httpOnly: true,
            secure,
            sameSite: 'Lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 30 // 30 dias
        }));
        return updated;
    } catch (e) {
        console.error('Erro ao renovar token Google:', e);
        return null;
    }
}

async function getValidSession(req, res) {
    const cookies = parseCookies(req);
    const session = decryptSession(cookies[COOKIE_NAME]);
    if (!session || !session.accessToken) return null;

    // Se o token expirou (ou está prestes a expirar), renova com refresh_token ou invalida o cookie
    if (session.expiresAt && Date.now() > session.expiresAt - 60000) {
        const refreshed = await refreshGoogleSession(req, res, session);
        if (!refreshed) {
            clearSessionCookie(req, res);
            return null;
        }
        return refreshed;
    }

    return session;
}

async function runWithGoogleSession(req, res, session, fn) {
    try {
        return await fn(session.accessToken);
    } catch (err) {
        if (err && err.isGoogleAuthError) {
            const refreshed = await refreshGoogleSession(req, res, session);
            if (refreshed) {
                try {
                    return await fn(refreshed.accessToken);
                } catch (retryErr) {
                    if (retryErr && retryErr.isGoogleAuthError) {
                        clearSessionCookie(req, res);
                    }
                    throw retryErr;
                }
            }
            clearSessionCookie(req, res);
        }
        throw err;
    }
}

// ============================================================================
// 2. INTEGRAÇÃO SUPABASE (REST API / PostgREST)
// ============================================================================
// Fallback em memória caso variáveis do Supabase ainda não estejam configuradas
const memoryStore = {
    prices: {},
    mappings: {}
};

function getSupabaseConfig() {
    const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    const schema = (process.env.SUPABASE_SCHEMA || 'go_fechamento').trim();
    if (!url || !key) return null;
    return { url, key, schema };
}

async function verifySupabaseAuth(req) {
    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.slice(7).trim();
    if (!token) return null;

    const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    if (!url || !apiKey) return null;

    try {
        const userRes = await fetch(`${url}/auth/v1/user`, {
            headers: {
                'apikey': apiKey,
                'Authorization': `Bearer ${token}`
            }
        });
        if (!userRes.ok) return null;
        return await userRes.json();
    } catch (e) {
        return null;
    }
}

async function supabaseRequest(table, { method = 'GET', query = '', body = null, prefer = '', schema = null } = {}) {
    const cfg = getSupabaseConfig();
    if (!cfg) return null;

    const targetSchema = schema || cfg.schema;
    const headers = {
        'apikey': cfg.key,
        'Content-Type': 'application/json',
        'Accept-Profile': targetSchema,
        'Content-Profile': targetSchema
    };
    if (!cfg.key.startsWith('sb_')) {
        headers['Authorization'] = `Bearer ${cfg.key}`;
    }
    if (prefer) {
        headers['Prefer'] = prefer;
    }

    const url = `${cfg.url}/rest/v1/${table}${query ? `?${query}` : ''}`;
    const response = await fetch(url, {
        method,
        headers,
        body: body !== null ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Supabase error (${response.status}): ${errText}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

// ============================================================================
// 3. SERVIÇOS GOOGLE CALENDAR & GOOGLE SHEETS
// ============================================================================
const WEEKDAYS_PT = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado'
];

const MONTHS_FULL_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTHS_SHORT_PT = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

function getLastDayOfMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

function formatEventDateInSaoPaulo(eventStart) {
    if (!eventStart) return null;
    // Evento de dia inteiro (YYYY-MM-DD) vs Evento com horário (ISO DateTime)
    if (eventStart.date && !eventStart.dateTime) {
        const [y, m, d] = eventStart.date.split('-').map(Number);
        const utcDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
        const dayOfWeek = WEEKDAYS_PT[utcDate.getUTCDay()];
        const isoDate = eventStart.date;
        const displayDate = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
        return `${isoDate}|${displayDate}|${dayOfWeek}`;
    }

    const raw = eventStart.dateTime || eventStart.date;
    if (!raw) return null;

    const dateObj = new Date(raw);
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'long'
    }).formatToParts(dateObj);

    const map = {};
    for (const p of parts) {
        map[p.type] = p.value;
    }

    const isoDate = `${map.year}-${map.month}-${map.day}`;
    const displayDate = `${map.day}/${map.month}/${map.year}`;
    const weekdayRaw = map.weekday || '';
    const dayOfWeek = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);
    return `${isoDate}|${displayDate}|${dayOfWeek}`;
}

async function fetchAtendimentosFromGoogle(accessToken, meses) {
    const counts = {};
    const patientDates = {};

    for (const mes of meses) {
        const [yearStr, monthStr] = mes.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        if (!year || !month) continue;

        const lastDay = getLastDayOfMonth(year, month);
        const timeMin = `${year}-${String(month).padStart(2, '0')}-01T00:00:00-03:00`;
        const timeMax = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59-03:00`;

        let pageToken = '';
        do {
            const params = new URLSearchParams({
                timeMin,
                timeMax,
                orderBy: 'startTime',
                singleEvents: 'true',
                maxResults: '2500'
            });
            if (pageToken) params.set('pageToken', pageToken);

            const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!response.ok) {
                const errText = await response.text();
                throw createGoogleApiError(`Falha na API do Google Calendar (${response.status}): ${errText}`, response.status);
            }

            const data = await response.json();
            const items = data.items || [];

            for (const event of items) {
                const summary = event.summary;
                if (summary && summary.trim().startsWith('#')) {
                    let name = summary.trim().substring(1).trim();
                    if (!name) continue;
                    name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

                    counts[name] = (counts[name] || 0) + 1;

                    const formattedDate = formatEventDateInSaoPaulo(event.start);
                    if (formattedDate) {
                        if (!patientDates[name]) patientDates[name] = [];
                        patientDates[name].push(formattedDate);
                    }
                }
            }

            pageToken = data.nextPageToken || '';
        } while (pageToken);
    }

    const result = Object.keys(counts).map(name => {
        const dates = (patientDates[name] || []).slice().sort();
        return {
            name,
            count: counts[name],
            price: 0.0,
            statusPago: 'Não',
            valorRecebido: 0.0,
            dates
        };
    });

    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
}

function getSaoPauloTodayStr() {
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const map = {};
    for (const p of parts) map[p.type] = p.value;
    return `${map.year}-${map.month}-${map.day}`;
}

function shiftMonth(monthStr, delta) {
    const [yStr, mStr] = monthStr.split('-');
    let year = parseInt(yStr, 10);
    let month = parseInt(mStr, 10) + delta;
    while (month < 1) {
        month += 12;
        year -= 1;
    }
    while (month > 12) {
        month -= 12;
        year += 1;
    }
    return `${year}-${String(month).padStart(2, '0')}`;
}

function getThreeMonthWindow(baseMonthStr) {
    const currentMonth = baseMonthStr && /^\d{4}-\d{2}$/.test(baseMonthStr)
        ? baseMonthStr
        : getSaoPauloTodayStr().slice(0, 7);
    const prevMonth = shiftMonth(currentMonth, -1);
    const nextMonth = shiftMonth(currentMonth, 1);
    const [ny, nm] = nextMonth.split('-').map(Number);
    const lastDay = getLastDayOfMonth(ny, nm);
    return {
        prevMonth,
        currentMonth,
        nextMonth,
        months: [prevMonth, currentMonth, nextMonth],
        startDate: `${prevMonth}-01`,
        endDate: `${nextMonth}-${String(lastDay).padStart(2, '0')}`
    };
}

function normalizeCalendarName(summary) {
    const raw = summary.trim().substring(1).trim();
    if (!raw) return '';
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function extractTimeInSaoPaulo(eventStart) {
    if (!eventStart || !eventStart.dateTime) return 'Dia inteiro';
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(new Date(eventStart.dateTime));
    const map = {};
    for (const p of parts) map[p.type] = p.value;
    return `${map.hour}:${map.minute}`;
}

async function fetchDetailedEventsFromGoogle(accessToken, startDate, endDate) {
    const timeMin = `${startDate}T00:00:00-03:00`;
    const timeMax = `${endDate}T23:59:59-03:00`;
    const events = [];

    let pageToken = '';
    do {
        const params = new URLSearchParams({
            timeMin,
            timeMax,
            orderBy: 'startTime',
            singleEvents: 'true',
            maxResults: '2500'
        });
        if (pageToken) params.set('pageToken', pageToken);

        const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Falha na API do Google Calendar (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const items = data.items || [];

        for (const event of items) {
            if (event.status === 'cancelled') continue;
            const summary = event.summary;
            if (!summary || !summary.trim().startsWith('#')) continue;
            const calendarName = normalizeCalendarName(summary);
            if (!calendarName) continue;

            const formattedDate = formatEventDateInSaoPaulo(event.start);
            if (!formattedDate) continue;
            const [isoDate, displayDate, weekday] = formattedDate.split('|');

            const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
            const startTime = extractTimeInSaoPaulo(event.start);
            const endTime = isAllDay ? 'Dia inteiro' : extractTimeInSaoPaulo(event.end);
            const eventDatetime = event.start?.dateTime || `${isoDate}T12:00:00-03:00`;
            const endDatetime = event.end?.dateTime || eventDatetime;

            let durationMinutes = null;
            if (!isAllDay && event.start?.dateTime && event.end?.dateTime) {
                const diffMs = new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime();
                if (Number.isFinite(diffMs) && diffMs > 0) {
                    durationMinutes = Math.round(diffMs / 60000);
                }
            }

            events.push({
                eventId: event.id,
                date: isoDate,
                displayDate,
                weekday,
                startTime,
                endTime,
                isAllDay,
                durationMinutes,
                eventDatetime,
                endDatetime,
                monthKey: isoDate.slice(0, 7),
                rawSummary: summary.trim(),
                calendarName
            });
        }

        pageToken = data.nextPageToken || '';
    } while (pageToken);

    events.sort((a, b) => a.eventDatetime.localeCompare(b.eventDatetime));
    return events;
}

async function recalculatePackageStatusesByIds(packageIds) {
    const cfg = getSupabaseConfig();
    if (!cfg) return;

    const cleanIds = Array.from(new Set((packageIds || []).filter(Boolean)));
    if (cleanIds.length === 0) return;

    const pkgs = (await supabaseRequest('packages', {
        query: `select=id,total_sessions,initial_offset,status&id=in.(${cleanIds.map(encodeURIComponent).join(',')})`
    })) || [];
    if (pkgs.length === 0) return;

    const sessions = (await supabaseRequest('package_sessions', {
        query: `select=id,package_id&package_id=in.(${cleanIds.map(encodeURIComponent).join(',')})`
    })) || [];

    const countByPkg = {};
    for (const s of sessions) {
        countByPkg[s.package_id] = (countByPkg[s.package_id] || 0) + 1;
    }

    for (const pkg of pkgs) {
        if (pkg.status === 'cancelled') continue;
        const used = (pkg.initial_offset || 0) + (countByPkg[pkg.id] || 0);
        const expected = used >= pkg.total_sessions ? 'completed' : 'active';
        if (pkg.status !== expected) {
            await supabaseRequest('packages', {
                method: 'PATCH',
                query: `id=eq.${encodeURIComponent(pkg.id)}`,
                body: { status: expected, updated_at: new Date().toISOString() }
            });
        }
    }
}

async function recalculatePackageStatuses(pacienteId = null) {
    const cfg = getSupabaseConfig();
    if (!cfg) return;

    const pkgQuery = pacienteId
        ? `select=id,total_sessions,initial_offset,status&paciente_id=eq.${encodeURIComponent(pacienteId)}`
        : 'select=id,total_sessions,initial_offset,status';

    const pkgs = (await supabaseRequest('packages', { query: pkgQuery })) || [];
    if (pkgs.length === 0) return;

    await recalculatePackageStatusesByIds(pkgs.map(p => p.id));
}

async function syncAndDistributePackages(calendarEvents, windowStart, windowEnd) {
    const [linksRaw, mappingsRaw, packagesRaw, sessionsRaw, exclusionsRaw] = await Promise.all([
        supabaseRequest('patient_calendar_links', { query: 'select=*' }).catch(() => []),
        supabaseRequest('patient_name_mappings', { query: 'select=month_key,old_name,new_name' }).catch(() => []),
        supabaseRequest('packages', { query: 'select=*&order=start_date.asc.nullslast,created_at.asc' }).catch(() => []),
        supabaseRequest('package_sessions', { query: 'select=*&order=event_date.asc,event_datetime.asc' }).catch(() => []),
        supabaseRequest('package_session_exclusions', { query: 'select=*' }).catch(() => [])
    ]);

    const links = linksRaw || [];
    const mappings = mappingsRaw || [];
    let packages = packagesRaw || [];
    let sessions = sessionsRaw || [];
    const exclusions = exclusionsRaw || [];

    // 1. Reconciliar alterações da agenda dentro da janela consultada
    if (Array.isArray(calendarEvents) && windowStart && windowEnd) {
        const eventById = new Map(calendarEvents.map(e => [e.eventId, e]));
        let changed = false;

        for (const s of sessions) {
            if (s.event_date >= windowStart && s.event_date <= windowEnd) {
                const live = eventById.get(s.calendar_event_id);
                if (!live) {
                    // Evento foi apagado ou desmarcado no Google Calendar
                    await supabaseRequest('package_sessions', {
                        method: 'DELETE',
                        query: `id=eq.${encodeURIComponent(s.id)}`
                    });
                    changed = true;
                } else if (
                    live.date !== s.event_date ||
                    live.rawSummary !== s.calendar_summary
                ) {
                    await supabaseRequest('package_sessions', {
                        method: 'PATCH',
                        query: `id=eq.${encodeURIComponent(s.id)}`,
                        body: {
                            event_date: live.date,
                            event_datetime: live.eventDatetime,
                            calendar_summary: live.rawSummary,
                            calendar_name: live.calendarName
                        }
                    });
                    changed = true;
                }
            }
        }

        if (changed) {
            sessions = (await supabaseRequest('package_sessions', {
                query: 'select=*&order=event_date.asc,event_datetime.asc'
            })) || [];
        }
    }

    // 2. Mapear nomes da agenda + agrupamentos -> paciente_id
    const linkByLower = {};
    for (const l of links) {
        linkByLower[l.calendar_name.toLowerCase().trim()] = l.paciente_id;
    }

    const mappingByMonth = {};
    const fallbackMapping = {};
    for (const m of mappings) {
        if (!mappingByMonth[m.month_key]) mappingByMonth[m.month_key] = {};
        const oldLow = m.old_name.toLowerCase().trim();
        mappingByMonth[m.month_key][oldLow] = m.new_name;
        fallbackMapping[oldLow] = m.new_name;
    }

    const resolvePacienteId = (calendarName, monthKey) => {
        const low = calendarName.toLowerCase().trim();
        if (linkByLower[low]) return linkByLower[low];
        const mapped = mappingByMonth[monthKey]?.[low] || fallbackMapping[low];
        if (mapped) {
            const mappedLow = mapped.toLowerCase().trim();
            if (linkByLower[mappedLow]) return linkByLower[mappedLow];
        }
        return null;
    };

    // 3. Auto-distribuir novos atendimentos elegíveis para pacotes com start_date definido
    if (Array.isArray(calendarEvents) && calendarEvents.length > 0) {
        const assignedEventIds = new Set(sessions.map(s => s.calendar_event_id));
        const excludedEventIds = new Set(exclusions.map(x => x.calendar_event_id));

        const countByPkg = {};
        for (const s of sessions) {
            countByPkg[s.package_id] = (countByPkg[s.package_id] || 0) + 1;
        }

        const usedByPkg = {};
        const packagesByPaciente = {};
        for (const pkg of packages) {
            usedByPkg[pkg.id] = (pkg.initial_offset || 0) + (countByPkg[pkg.id] || 0);
            if (pkg.paciente_id) {
                if (!packagesByPaciente[pkg.paciente_id]) packagesByPaciente[pkg.paciente_id] = [];
                packagesByPaciente[pkg.paciente_id].push(pkg);
            }
        }

        const rowsToInsert = [];
        for (const ev of calendarEvents) {
            if (assignedEventIds.has(ev.eventId) || excludedEventIds.has(ev.eventId)) continue;
            const pacienteId = resolvePacienteId(ev.calendarName, ev.monthKey);
            if (!pacienteId) continue;

            const candidatePkgs = packagesByPaciente[pacienteId] || [];
            const targetPkg = candidatePkgs.find(pkg =>
                pkg.status !== 'cancelled' &&
                pkg.start_date &&
                ev.date >= pkg.start_date &&
                (usedByPkg[pkg.id] || 0) < pkg.total_sessions
            );

            if (targetPkg) {
                rowsToInsert.push({
                    package_id: targetPkg.id,
                    calendar_event_id: ev.eventId,
                    event_date: ev.date,
                    event_datetime: ev.eventDatetime,
                    calendar_summary: ev.rawSummary,
                    calendar_name: ev.calendarName
                });
                assignedEventIds.add(ev.eventId);
                usedByPkg[targetPkg.id] = (usedByPkg[targetPkg.id] || 0) + 1;
            }
        }

        if (rowsToInsert.length > 0) {
            await supabaseRequest('package_sessions', {
                method: 'POST',
                query: 'on_conflict=calendar_event_id',
                prefer: 'resolution=merge-duplicates',
                body: rowsToInsert
            });
            sessions = (await supabaseRequest('package_sessions', {
                query: 'select=*&order=event_date.asc,event_datetime.asc'
            })) || [];
        }
    }

    // 4. Recalcular status dos pacotes (active vs completed)
    await recalculatePackageStatuses();
    packages = (await supabaseRequest('packages', {
        query: 'select=*&order=start_date.asc.nullslast,created_at.desc'
    })) || [];

    return { links, mappings, packages, sessions, exclusions };
}

function generateTitle(meses) {
    if (!meses || meses.length === 0) {
        return 'Go Fisio Fechamento';
    }

    const parsed = meses
        .map(m => {
            const [y, mo] = m.split('-').map(Number);
            return { raw: m, year: y, month: mo };
        })
        .filter(x => x.year && x.month)
        .sort((a, b) => a.raw.localeCompare(b.raw));

    if (parsed.length === 1) {
        const ym = parsed[0];
        return `${MONTHS_FULL_PT[ym.month - 1]} ${ym.year} - Go Fisio Fechamento`;
    }

    const firstYear = parsed[0].year;
    const sameYear = parsed.every(ym => ym.year === firstYear);

    if (sameYear) {
        const shortNames = parsed.map(ym => MONTHS_SHORT_PT[ym.month - 1]).join(' ');
        return `${shortNames} ${firstYear} - Go Fisio Fechamento`;
    } else {
        const parts = parsed.map(ym => `${MONTHS_SHORT_PT[ym.month - 1]} ${ym.year}`).join(' - ');
        return `${parts} - Go Fisio Fechamento`;
    }
}

const PALETTE = [
    // 0. Ocean Teal
    {
        headerBg: { red: 0.12, green: 0.45, blue: 0.45 },
        headerFg: { red: 1.0, green: 1.0, blue: 1.0 },
        subheaderBg: { red: 0.85, green: 0.94, blue: 0.94 },
        subheaderFg: { red: 0.10, green: 0.30, blue: 0.30 },
        border: { red: 0.70, green: 0.85, blue: 0.85 }
    },
    // 1. Royal Indigo
    {
        headerBg: { red: 0.25, green: 0.32, blue: 0.65 },
        headerFg: { red: 1.0, green: 1.0, blue: 1.0 },
        subheaderBg: { red: 0.88, green: 0.90, blue: 0.98 },
        subheaderFg: { red: 0.15, green: 0.20, blue: 0.45 },
        border: { red: 0.75, green: 0.80, blue: 0.92 }
    },
    // 2. Forest Emerald
    {
        headerBg: { red: 0.15, green: 0.50, blue: 0.30 },
        headerFg: { red: 1.0, green: 1.0, blue: 1.0 },
        subheaderBg: { red: 0.86, green: 0.95, blue: 0.89 },
        subheaderFg: { red: 0.10, green: 0.35, blue: 0.20 },
        border: { red: 0.70, green: 0.88, blue: 0.75 }
    },
    // 3. Warm Amber
    {
        headerBg: { red: 0.75, green: 0.42, blue: 0.15 },
        headerFg: { red: 1.0, green: 1.0, blue: 1.0 },
        subheaderBg: { red: 0.98, green: 0.92, blue: 0.85 },
        subheaderFg: { red: 0.50, green: 0.25, blue: 0.05 },
        border: { red: 0.92, green: 0.82, blue: 0.70 }
    },
    // 4. Berry Purple
    {
        headerBg: { red: 0.48, green: 0.25, blue: 0.62 },
        headerFg: { red: 1.0, green: 1.0, blue: 1.0 },
        subheaderBg: { red: 0.93, green: 0.88, blue: 0.96 },
        subheaderFg: { red: 0.30, green: 0.12, blue: 0.42 },
        border: { red: 0.85, green: 0.75, blue: 0.90 }
    },
    // 5. Crimson Rose
    {
        headerBg: { red: 0.72, green: 0.28, blue: 0.38 },
        headerFg: { red: 1.0, green: 1.0, blue: 1.0 },
        subheaderBg: { red: 0.97, green: 0.88, blue: 0.90 },
        subheaderFg: { red: 0.45, green: 0.12, blue: 0.20 },
        border: { red: 0.92, green: 0.75, blue: 0.80 }
    },
    // 6. Slate Steel
    {
        headerBg: { red: 0.28, green: 0.38, blue: 0.48 },
        headerFg: { red: 1.0, green: 1.0, blue: 1.0 },
        subheaderBg: { red: 0.89, green: 0.92, blue: 0.95 },
        subheaderFg: { red: 0.18, green: 0.25, blue: 0.35 },
        border: { red: 0.78, green: 0.82, blue: 0.88 }
    },
    // 7. Dark Cyan
    {
        headerBg: { red: 0.08, green: 0.52, blue: 0.58 },
        headerFg: { red: 1.0, green: 1.0, blue: 1.0 },
        subheaderBg: { red: 0.85, green: 0.95, blue: 0.96 },
        subheaderFg: { red: 0.05, green: 0.35, blue: 0.40 },
        border: { red: 0.70, green: 0.88, blue: 0.90 }
    }
];

async function exportToSheetsOnGoogle(accessToken, meses, patients) {
    const title = generateTitle(meses);

    // 1. Criar planilha com 2 abas: "Fechamento" (Id 0) e "Datas" (Id 1)
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            properties: { title },
            sheets: [
                { properties: { sheetId: 0, title: 'Fechamento' } },
                { properties: { sheetId: 1, title: 'Datas' } }
            ]
        })
    });

    if (!createRes.ok) {
        const errText = await createRes.text();
        throw createGoogleApiError(`Erro ao criar planilha (${createRes.status}): ${errText}`, createRes.status);
    }

    const spreadsheet = await createRes.json();
    const spreadsheetId = spreadsheet.spreadsheetId;

    // 2. Montar dados da Aba 1 ("Fechamento")
    const values = [
        [
            'Nome do Cliente', 'Valor do Atendimento (R$)', 'Quantidade de Atendimentos',
            'Pago (Sim/Não)', 'Valor Total (R$)', 'Valor Imposto Simples Nacional (6%) (R$)',
            'Valor impostos extras (2%)', 'Valor retirando os Impostos',
            'Valor Recebido Referente o Mês', 'Valor que falta'
        ]
    ];

    let rowIndex = 2;
    for (const p of patients) {
        const b = `B${rowIndex}`;
        const c = `C${rowIndex}`;
        const e = `E${rowIndex}`;
        const f = `F${rowIndex}`;
        const g = `G${rowIndex}`;
        const i = `I${rowIndex}`;

        values.push([
            p.name,
            p.price,
            p.count,
            p.statusPago != null ? p.statusPago : 'Não',
            `=${b}*${c}`,
            `=${e}*0,06`,
            `=${e}*0,02`,
            `=${e}-${f}-${g}`,
            p.valorRecebido,
            `=${e}-${i}`
        ]);
        rowIndex++;
    }

    values.push(['', '', '', '', '', '', '', '', '', '']);
    rowIndex++;

    const lastData = rowIndex - 2;
    values.push([
        '', '', '', 'Totais',
        `=SUM(E2:E${lastData})`,
        `=SUM(F2:F${lastData})`,
        `=SUM(G2:G${lastData})`,
        `=SUM(H2:H${lastData})`,
        `=SUM(I2:I${lastData})`,
        `=SUM(J2:J${lastData})`
    ]);

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent("'Fechamento'!A1")}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
    });

    // 3. Tabela Extra de Totais (Coluna M na Aba "Fechamento")
    const summaryValues = [
        ['Totais', ''],
        ['', ''],
        ['Valor total a ser arrecadado no Mês', `=SUM(E2:E${lastData})`],
        ['', ''],
        ['Valor aproximado de impostos', `=SUM(F2:F${lastData})+SUM(G2:G${lastData})`],
        ['', ''],
        ['', ''],
        ['', ''],
        ['Valor total tirando impostos', `=SUM(H2:H${lastData})`],
        ['', ''],
        ['', ''],
        ['', ''],
        ['Falta receber (Aproximadamente)', `=SUM(J2:J${lastData})`]
    ];

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent("'Fechamento'!M1")}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: summaryValues })
    });

    // 4. Montar dados da Aba 2 ("Datas")
    const datesSheetValues = [];
    const requests = [];

    let currentStartRow = 0;
    const patientsPerRow = 3;

    for (let i = 0; i < patients.length; i += patientsPerRow) {
        const batch = patients.slice(i, Math.min(i + patientsPerRow, patients.length));

        let maxDatesInBatch = 0;
        for (const p of batch) {
            const dateCount = Array.isArray(p.dates) ? p.dates.length : 0;
            if (dateCount > maxDatesInBatch) maxDatesInBatch = dateCount;
        }
        if (maxDatesInBatch === 0) maxDatesInBatch = 1;

        const headerRow = [];
        const subheaderRow = [];
        const dateRows = Array.from({ length: maxDatesInBatch }, () => []);
        const footerRow = [];

        for (let colIndex = 0; colIndex < 3; colIndex++) {
            if (colIndex > 0) {
                headerRow.push('');
                subheaderRow.push('');
                for (let d = 0; d < maxDatesInBatch; d++) {
                    dateRows[d].push('');
                }
                footerRow.push('');
            }

            if (colIndex < batch.length) {
                const p = batch[colIndex];
                headerRow.push(`${p.name.toUpperCase()} (${p.count} atendimentos)`);
                headerRow.push('');

                subheaderRow.push('Data');
                subheaderRow.push('Dia da Semana');

                const pDates = Array.isArray(p.dates) ? p.dates.slice().sort() : [];
                for (let d = 0; d < maxDatesInBatch; d++) {
                    if (d < pDates.length) {
                        const rawDate = pDates[d];
                        const parts = rawDate.split('|');
                        if (parts.length >= 3) {
                            dateRows[d].push(parts[1], parts[2]);
                        } else if (parts.length === 2) {
                            dateRows[d].push(parts[0], parts[1]);
                        } else {
                            dateRows[d].push(rawDate, '');
                        }
                    } else {
                        dateRows[d].push('', '');
                    }
                }

                const totalValue = (p.count || 0) * (p.price || 0);
                footerRow.push('Valor Total:', totalValue);

                const pGlobalIndex = i + colIndex;
                const theme = PALETTE[pGlobalIndex % PALETTE.length];
                const startCol = colIndex * 3;
                const endCol = startCol + 2;
                const dateEndRow = currentStartRow + 2 + maxDatesInBatch;
                const footerRowIndex = dateEndRow;
                const endRow = footerRowIndex + 1;

                requests.push({
                    mergeCells: {
                        range: {
                            sheetId: 1,
                            startRowIndex: currentStartRow,
                            endRowIndex: currentStartRow + 1,
                            startColumnIndex: startCol,
                            endColumnIndex: endCol
                        },
                        mergeType: 'MERGE_ALL'
                    }
                });

                requests.push({
                    repeatCell: {
                        range: {
                            sheetId: 1,
                            startRowIndex: currentStartRow,
                            endRowIndex: currentStartRow + 1,
                            startColumnIndex: startCol,
                            endColumnIndex: endCol
                        },
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: theme.headerBg,
                                textFormat: { foregroundColor: theme.headerFg, bold: true, fontSize: 11 },
                                horizontalAlignment: 'CENTER',
                                verticalAlignment: 'MIDDLE'
                            }
                        },
                        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
                    }
                });

                requests.push({
                    repeatCell: {
                        range: {
                            sheetId: 1,
                            startRowIndex: currentStartRow + 1,
                            endRowIndex: currentStartRow + 2,
                            startColumnIndex: startCol,
                            endColumnIndex: endCol
                        },
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: theme.subheaderBg,
                                textFormat: { foregroundColor: theme.subheaderFg, bold: true },
                                horizontalAlignment: 'CENTER'
                            }
                        },
                        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                    }
                });

                requests.push({
                    repeatCell: {
                        range: {
                            sheetId: 1,
                            startRowIndex: currentStartRow + 2,
                            endRowIndex: dateEndRow,
                            startColumnIndex: startCol,
                            endColumnIndex: endCol
                        },
                        cell: {
                            userEnteredFormat: {
                                horizontalAlignment: 'CENTER',
                                textFormat: { fontSize: 10 }
                            }
                        },
                        fields: 'userEnteredFormat(horizontalAlignment,textFormat)'
                    }
                });

                requests.push({
                    repeatCell: {
                        range: {
                            sheetId: 1,
                            startRowIndex: footerRowIndex,
                            endRowIndex: footerRowIndex + 1,
                            startColumnIndex: startCol,
                            endColumnIndex: startCol + 1
                        },
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: theme.subheaderBg,
                                textFormat: { foregroundColor: theme.subheaderFg, bold: true },
                                horizontalAlignment: 'CENTER'
                            }
                        },
                        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                    }
                });

                requests.push({
                    repeatCell: {
                        range: {
                            sheetId: 1,
                            startRowIndex: footerRowIndex,
                            endRowIndex: footerRowIndex + 1,
                            startColumnIndex: startCol + 1,
                            endColumnIndex: endCol
                        },
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: theme.subheaderBg,
                                textFormat: { foregroundColor: theme.subheaderFg, bold: true },
                                numberFormat: { type: 'CURRENCY', pattern: '"R$" #,##0.00' },
                                horizontalAlignment: 'CENTER'
                            }
                        },
                        fields: 'userEnteredFormat(backgroundColor,textFormat,numberFormat,horizontalAlignment)'
                    }
                });

                const solidBorder = { style: 'SOLID', color: theme.border };
                const lightBorder = { style: 'SOLID', color: { red: 0.92, green: 0.92, blue: 0.92 } };

                requests.push({
                    updateBorders: {
                        range: {
                            sheetId: 1,
                            startRowIndex: currentStartRow,
                            endRowIndex: endRow,
                            startColumnIndex: startCol,
                            endColumnIndex: endCol
                        },
                        top: solidBorder,
                        bottom: solidBorder,
                        left: solidBorder,
                        right: solidBorder,
                        innerHorizontal: lightBorder,
                        innerVertical: lightBorder
                    }
                });
            } else {
                headerRow.push('', '');
                subheaderRow.push('', '');
                for (let d = 0; d < maxDatesInBatch; d++) {
                    dateRows[d].push('', '');
                }
                footerRow.push('', '');
            }
        }

        datesSheetValues.push(headerRow, subheaderRow, ...dateRows, footerRow);
        datesSheetValues.push(['', '', '', '', '', '', '', '', '']);
        datesSheetValues.push(['', '', '', '', '', '', '', '', '']);

        currentStartRow += 2 + maxDatesInBatch + 1 + 2;
    }

    if (datesSheetValues.length > 0) {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent("'Datas'!A1")}?valueInputOption=USER_ENTERED`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ values: datesSheetValues })
        });
    }

    for (const col of [2, 5, 8]) {
        requests.push({
            updateDimensionProperties: {
                range: { sheetId: 1, dimension: 'COLUMNS', startIndex: col, endIndex: col + 1 },
                properties: { pixelSize: 30 },
                fields: 'pixelSize'
            }
        });
    }

    requests.push({
        autoResizeDimensions: {
            dimensions: { sheetId: 1, dimension: 'COLUMNS', startIndex: 0, endIndex: 8 }
        }
    });

    // 5. Formatação da Aba 1 ("Fechamento")
    requests.push({
        repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 10 },
            cell: {
                userEnteredFormat: {
                    backgroundColor: { red: 0.6, green: 0.6, blue: 0.6 },
                    textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }
                }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
        }
    });

    requests.push({
        repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 12, endColumnIndex: 14 },
            cell: {
                userEnteredFormat: {
                    backgroundColor: { red: 0.6, green: 0.6, blue: 0.6 },
                    textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
                    horizontalAlignment: 'CENTER'
                }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
        }
    });

    requests.push({
        mergeCells: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 12, endColumnIndex: 14 },
            mergeType: 'MERGE_ALL'
        }
    });

    requests.push({
        repeatCell: {
            range: { sheetId: 0, startRowIndex: 2, endRowIndex: 13, startColumnIndex: 12, endColumnIndex: 13 },
            cell: {
                userEnteredFormat: {
                    backgroundColor: { red: 0.85, green: 0.85, blue: 0.85 }
                }
            },
            fields: 'userEnteredFormat(backgroundColor)'
        }
    });

    requests.push({
        repeatCell: {
            range: { sheetId: 0, startRowIndex: 2, endRowIndex: 13, startColumnIndex: 13, endColumnIndex: 14 },
            cell: {
                userEnteredFormat: {
                    backgroundColor: { red: 0.8, green: 0.9, blue: 1 },
                    numberFormat: { type: 'CURRENCY', pattern: '"R$" #,##0.00' }
                }
            },
            fields: 'userEnteredFormat(backgroundColor,numberFormat)'
        }
    });

    requests.push({
        repeatCell: {
            range: { sheetId: 0, startRowIndex: 1, endRowIndex: rowIndex, startColumnIndex: 1, endColumnIndex: 2 },
            cell: {
                userEnteredFormat: {
                    numberFormat: { type: 'CURRENCY', pattern: '"R$" #,##0.00' }
                }
            },
            fields: 'userEnteredFormat.numberFormat'
        }
    });

    requests.push({
        repeatCell: {
            range: { sheetId: 0, startRowIndex: 1, endRowIndex: rowIndex, startColumnIndex: 4, endColumnIndex: 10 },
            cell: {
                userEnteredFormat: {
                    numberFormat: { type: 'CURRENCY', pattern: '"R$" #,##0.00' }
                }
            },
            fields: 'userEnteredFormat.numberFormat'
        }
    });

    requests.push({
        setDataValidation: {
            range: { sheetId: 0, startRowIndex: 1, endRowIndex: rowIndex - 1, startColumnIndex: 3, endColumnIndex: 4 },
            rule: {
                condition: {
                    type: 'ONE_OF_LIST',
                    values: [
                        { userEnteredValue: 'Sim' },
                        { userEnteredValue: 'Não' },
                        { userEnteredValue: 'Parcial' }
                    ]
                },
                showCustomUi: true
            }
        }
    });

    requests.push({
        addConditionalFormatRule: {
            rule: {
                ranges: [{ sheetId: 0, startRowIndex: 1, endRowIndex: rowIndex - 1, startColumnIndex: 3, endColumnIndex: 4 }],
                booleanRule: {
                    condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'Sim' }] },
                    format: {
                        backgroundColor: { red: 0.82, green: 0.98, blue: 0.9 },
                        textFormat: { foregroundColor: { red: 0.02, green: 0.37, blue: 0.27 }, bold: true }
                    }
                }
            },
            index: 0
        }
    });

    requests.push({
        addConditionalFormatRule: {
            rule: {
                ranges: [{ sheetId: 0, startRowIndex: 1, endRowIndex: rowIndex - 1, startColumnIndex: 3, endColumnIndex: 4 }],
                booleanRule: {
                    condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'Não' }] },
                    format: {
                        backgroundColor: { red: 0.99, green: 0.88, blue: 0.88 },
                        textFormat: { foregroundColor: { red: 0.6, green: 0.1, blue: 0.1 }, bold: true }
                    }
                }
            },
            index: 1
        }
    });

    requests.push({
        addConditionalFormatRule: {
            rule: {
                ranges: [{ sheetId: 0, startRowIndex: 1, endRowIndex: rowIndex - 1, startColumnIndex: 3, endColumnIndex: 4 }],
                booleanRule: {
                    condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'Parcial' }] },
                    format: {
                        backgroundColor: { red: 1.0, green: 0.95, blue: 0.78 },
                        textFormat: { foregroundColor: { red: 0.57, green: 0.25, blue: 0.05 }, bold: true }
                    }
                }
            },
            index: 2
        }
    });

    requests.push({
        autoResizeDimensions: {
            dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 12, endIndex: 14 }
        }
    });

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
    });

    return spreadsheet.spreadsheetUrl;
}

function parseMonthsQuery(query, searchParams) {
    const list = [];
    const rawItems = [];
    if (searchParams) {
        rawItems.push(...searchParams.getAll('meses'));
        rawItems.push(...searchParams.getAll('mes'));
    }
    if (query) {
        if (query.meses) {
            if (Array.isArray(query.meses)) rawItems.push(...query.meses);
            else rawItems.push(query.meses);
        }
        if (query.mes) {
            if (Array.isArray(query.mes)) rawItems.push(...query.mes);
            else rawItems.push(query.mes);
        }
    }

    for (const item of rawItems) {
        if (item) {
            for (const part of String(item).split(',')) {
                const trimmed = part.trim();
                if (trimmed && !list.includes(trimmed)) {
                    list.push(trimmed);
                }
            }
        }
    }
    list.sort();
    return list;
}

// ============================================================================
// 4. HANDLER PRINCIPAL SERVERLESS (Vercel)
// ============================================================================
module.exports = async function handler(req, res) {
    const parsedUrl = new URL(req.url, getBaseUrl(req));
    const rawPath = parsedUrl.searchParams.get('__path') || parsedUrl.pathname;
    const pathname = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const routeParam = parsedUrl.searchParams.get('route') || '';
    const method = req.method || 'GET';

    try {
        // --------------------------------------------------------------------
        // A. ROTAS DE AUTENTICAÇÃO GOOGLE OAUTH2
        // --------------------------------------------------------------------
        if (pathname === '/oauth2/authorization/google' || routeParam === 'oauth-login') {
            const clientId = process.env.GOOGLE_CLIENT_ID;
            if (!clientId) {
                return res.status(500).send('Erro de configuração: GOOGLE_CLIENT_ID não definido nas variáveis de ambiente.');
            }

            const state = crypto.randomBytes(16).toString('hex');
            const returnTo = sanitizeReturnTo(parsedUrl.searchParams.get('returnTo'));
            const secure = isSecureRequest(req);
            res.setHeader('Set-Cookie', [
                serializeCookie(STATE_COOKIE_NAME, state, {
                    httpOnly: true,
                    secure,
                    sameSite: 'Lax',
                    path: '/',
                    maxAge: 600
                }),
                serializeCookie(RETURN_TO_COOKIE_NAME, returnTo, {
                    httpOnly: true,
                    secure,
                    sameSite: 'Lax',
                    path: '/',
                    maxAge: 600
                })
            ]);

            const redirectUri = `${getBaseUrl(req)}/login/oauth2/code/google`;
            const params = new URLSearchParams({
                client_id: clientId,
                redirect_uri: redirectUri,
                response_type: 'code',
                scope: 'openid profile email https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/spreadsheets',
                access_type: 'offline',
                prompt: 'select_account consent',
                state
            });

            res.statusCode = 302;
            res.setHeader('Location', `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
            return res.end();
        }

        if (pathname === '/login/oauth2/code/google' || routeParam === 'oauth-callback') {
            const code = parsedUrl.searchParams.get('code');
            const error = parsedUrl.searchParams.get('error');
            const cookies = parseCookies(req);
            const returnTo = sanitizeReturnTo(cookies[RETURN_TO_COOKIE_NAME]);

            if (error || !code) {
                res.statusCode = 302;
                res.setHeader('Location', `${returnTo}?authError=1`);
                return res.end();
            }

            const redirectUri = `${getBaseUrl(req)}/login/oauth2/code/google`;
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code,
                    client_id: process.env.GOOGLE_CLIENT_ID || '',
                    client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
                    redirect_uri: redirectUri,
                    grant_type: 'authorization_code'
                }).toString()
            });

            if (!tokenRes.ok) {
                const errText = await tokenRes.text();
                console.error('Erro ao trocar code por token:', errText);
                return res.status(500).send(`Erro na autenticação com o Google. Verifique se a URL "${redirectUri}" está autorizada no Google Cloud Console e se GOOGLE_CLIENT_SECRET está correto.`);
            }

            const tokenData = await tokenRes.json();
            const accessToken = tokenData.access_token;
            const refreshToken = tokenData.refresh_token || null;
            const expiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;

            // Buscar dados do perfil
            let userName = 'Usuário';
            let userEmail = '';
            try {
                const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                if (userRes.ok) {
                    const profile = await userRes.json();
                    userName = profile.name || profile.email || 'Usuário';
                    userEmail = profile.email || '';
                }
            } catch (e) {
                console.error('Erro ao buscar perfil do Google:', e);
            }

            const sessionPayload = {
                accessToken,
                refreshToken,
                expiresAt,
                name: userName,
                email: userEmail
            };

            const secure = isSecureRequest(req);
            res.setHeader('Set-Cookie', [
                serializeCookie(COOKIE_NAME, encryptSession(sessionPayload), {
                    httpOnly: true,
                    secure,
                    sameSite: 'Lax',
                    path: '/',
                    maxAge: 60 * 60 * 24 * 30 // 30 dias
                }),
                serializeCookie(STATE_COOKIE_NAME, '', {
                    httpOnly: true,
                    secure,
                    sameSite: 'Lax',
                    path: '/',
                    maxAge: 0
                }),
                serializeCookie(RETURN_TO_COOKIE_NAME, '', {
                    httpOnly: true,
                    secure,
                    sameSite: 'Lax',
                    path: '/',
                    maxAge: 0
                })
            ]);

            res.statusCode = 302;
            res.setHeader('Location', returnTo);
            return res.end();
        }

        if (pathname === '/logout' || pathname === '/api/auth/logout' || routeParam === 'logout') {
            const secure = isSecureRequest(req);
            const returnTo = sanitizeReturnTo(parsedUrl.searchParams.get('returnTo'));
            res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, '', {
                httpOnly: true,
                secure,
                sameSite: 'Lax',
                path: '/',
                maxAge: 0
            }));
            if (method === 'POST' || (req.headers.accept || '').includes('application/json')) {
                return res.status(200).json({ ok: true });
            }
            res.statusCode = 302;
            res.setHeader('Location', returnTo);
            return res.end();
        }

        if (pathname === '/api/auth/status' && method === 'GET') {
            const session = await getValidSession(req, res);
            if (session) {
                return res.status(200).json({
                    authenticated: true,
                    googleConnected: true,
                    name: session.name,
                    email: session.email,
                    supabaseConfigured: Boolean(getSupabaseConfig())
                });
            }
            return res.status(200).json({
                authenticated: false,
                googleConnected: false,
                supabaseConfigured: Boolean(getSupabaseConfig())
            });
        }

        // --------------------------------------------------------------------
        // PROTEÇÃO DE ROTAS (Aceita Supabase Auth JWT ou Sessão Google)
        // --------------------------------------------------------------------
        const session = await getValidSession(req, res);
        const supabaseUser = await verifySupabaseAuth(req);
        if (!session && !supabaseUser) {
            return res.status(401).json({
                error: 'Não autenticado. Faça login no Go Administrativo.',
                code: 'AUTH_REQUIRED'
            });
        }

        // --------------------------------------------------------------------
        // B. ROTAS DE PERSISTÊNCIA (PREÇOS E MAPEAMENTOS NO SUPABASE)
        // --------------------------------------------------------------------
        // GET /api/prices
        if (pathname === '/api/prices' && method === 'GET') {
            const cfg = getSupabaseConfig();
            if (cfg) {
                const rows = await supabaseRequest('patient_prices', { query: 'select=name,price' });
                const map = {};
                for (const r of rows || []) {
                    map[r.name] = Number(r.price);
                }
                return res.status(200).json(map);
            }
            return res.status(200).json(memoryStore.prices);
        }

        // POST /api/prices
        if (pathname === '/api/prices' && method === 'POST') {
            const body = req.body || {};
            const name = (body.name || '').trim();
            const price = Number(body.price);
            if (!name || isNaN(price)) {
                return res.status(400).send('Nome e valor são obrigatórios.');
            }

            memoryStore.prices[name] = price;
            const cfg = getSupabaseConfig();
            if (cfg) {
                await supabaseRequest('patient_prices', {
                    method: 'POST',
                    query: 'on_conflict=name',
                    prefer: 'resolution=merge-duplicates',
                    body: [{ name, price }]
                });
            }
            return res.status(200).json({ ok: true });
        }

        // POST /api/prices/sync
        if (pathname === '/api/prices/sync' && method === 'POST') {
            const prices = req.body || {};
            const entries = Object.entries(prices)
                .filter(([k, v]) => k && v !== null && v !== undefined && !isNaN(Number(v)))
                .map(([k, v]) => ({ name: k.trim(), price: Number(v) }));

            for (const item of entries) {
                memoryStore.prices[item.name] = item.price;
            }

            const cfg = getSupabaseConfig();
            if (cfg && entries.length > 0) {
                await supabaseRequest('patient_prices', {
                    method: 'POST',
                    query: 'on_conflict=name',
                    prefer: 'resolution=merge-duplicates',
                    body: entries
                });
            }
            return res.status(200).json({ ok: true });
        }

        // DELETE /api/prices/:name
        if (pathname.startsWith('/api/prices/') && method === 'DELETE') {
            const name = decodeURIComponent(pathname.replace('/api/prices/', '')).trim();
            if (name) {
                delete memoryStore.prices[name];
                const cfg = getSupabaseConfig();
                if (cfg) {
                    await supabaseRequest('patient_prices', {
                        method: 'DELETE',
                        query: `name=eq.${encodeURIComponent(name)}`
                    });
                }
            }
            return res.status(200).json({ ok: true });
        }

        // GET /api/mappings
        if (pathname === '/api/mappings' && method === 'GET') {
            const cfg = getSupabaseConfig();
            if (cfg) {
                const rows = await supabaseRequest('patient_name_mappings', {
                    query: 'select=month_key,old_name,new_name'
                });
                const result = {};
                for (const m of rows || []) {
                    if (!result[m.month_key]) result[m.month_key] = {};
                    result[m.month_key][m.old_name] = m.new_name;
                }
                return res.status(200).json(result);
            }
            return res.status(200).json(memoryStore.mappings);
        }

        // POST /api/mappings
        if (pathname === '/api/mappings' && method === 'POST') {
            const body = req.body || {};
            const month = (body.month || '').trim();
            const oldName = (body.oldName || '').trim();
            const newName = (body.newName || '').trim();

            if (!month || !oldName || !newName) {
                return res.status(400).send('Mês, oldName e newName são obrigatórios.');
            }

            if (!memoryStore.mappings[month]) memoryStore.mappings[month] = {};
            Object.keys(memoryStore.mappings[month]).forEach(k => {
                if (memoryStore.mappings[month][k] === oldName) {
                    memoryStore.mappings[month][k] = newName;
                }
            });
            memoryStore.mappings[month][oldName] = newName;

            const cfg = getSupabaseConfig();
            if (cfg) {
                // Atualiza mapeamentos encadeados anteriores no mesmo mês
                await supabaseRequest('patient_name_mappings', {
                    method: 'PATCH',
                    query: `month_key=eq.${encodeURIComponent(month)}&new_name=eq.${encodeURIComponent(oldName)}`,
                    body: { new_name: newName }
                });

                // Insere ou atualiza (upsert) o mapeamento atual
                await supabaseRequest('patient_name_mappings', {
                    method: 'POST',
                    query: 'on_conflict=month_key,old_name',
                    prefer: 'resolution=merge-duplicates',
                    body: [{ month_key: month, old_name: oldName, new_name: newName }]
                });
            }

            return res.status(200).json({ ok: true });
        }

        // POST /api/mappings/sync
        if (pathname === '/api/mappings/sync' && method === 'POST') {
            const allMappings = req.body || {};
            const rowsToUpsert = [];

            for (const [month, monthMap] of Object.entries(allMappings)) {
                if (!monthMap || typeof monthMap !== 'object') continue;
                if (!memoryStore.mappings[month]) memoryStore.mappings[month] = {};
                for (const [oldName, newName] of Object.entries(monthMap)) {
                    if (oldName && newName) {
                        memoryStore.mappings[month][oldName] = newName;
                        rowsToUpsert.push({
                            month_key: month,
                            old_name: oldName,
                            new_name: newName
                        });
                    }
                }
            }

            const cfg = getSupabaseConfig();
            if (cfg && rowsToUpsert.length > 0) {
                await supabaseRequest('patient_name_mappings', {
                    method: 'POST',
                    query: 'on_conflict=month_key,old_name',
                    prefer: 'resolution=merge-duplicates',
                    body: rowsToUpsert
                });
            }

            return res.status(200).json({ ok: true });
        }

        // DELETE /api/mappings/reset
        if (pathname === '/api/mappings/reset' && method === 'DELETE') {
            const month = (parsedUrl.searchParams.get('month') || '').trim();
            if (month) {
                delete memoryStore.mappings[month];
                const cfg = getSupabaseConfig();
                if (cfg) {
                    await supabaseRequest('patient_name_mappings', {
                        method: 'DELETE',
                        query: `month_key=eq.${encodeURIComponent(month)}`
                    });
                }
            }
            return res.status(200).json({ ok: true });
        }

        // --------------------------------------------------------------------
        // C. ROTAS AUTENTICADAS DO GOOGLE CALENDAR E SHEETS
        // --------------------------------------------------------------------
        // GET /api/atendimentos
        if (pathname === '/api/atendimentos' && method === 'GET') {
            if (!session || !session.accessToken) {
                return res.status(401).json({
                    error: 'Conecte sua conta Google para importar os atendimentos do Calendar.',
                    code: 'GOOGLE_AUTH_REQUIRED'
                });
            }
            const monthList = parseMonthsQuery(req.query, parsedUrl.searchParams);
            if (monthList.length === 0) {
                return res.status(400).send('Nenhum mês foi informado.');
            }

            try {
                const data = await runWithGoogleSession(req, res, session, (token) =>
                    fetchAtendimentosFromGoogle(token, monthList)
                );
                return res.status(200).json(data);
            } catch (err) {
                if (err && err.isGoogleAuthError) {
                    return res.status(401).json({
                        error: 'Sua conexão com o Google expirou. Conecte novamente.',
                        code: 'GOOGLE_AUTH_REQUIRED'
                    });
                }
                throw err;
            }
        }

        // POST /api/exportar
        if (pathname === '/api/exportar' && method === 'POST') {
            if (!session || !session.accessToken) {
                return res.status(401).json({
                    error: 'Conecte sua conta Google para exportar para o Google Sheets.',
                    code: 'GOOGLE_AUTH_REQUIRED'
                });
            }
            const monthList = parseMonthsQuery(req.query, parsedUrl.searchParams);
            if (monthList.length === 0) {
                return res.status(400).send('Nenhum mês foi informado.');
            }

            const patients = Array.isArray(req.body) ? req.body : [];
            try {
                const url = await runWithGoogleSession(req, res, session, (token) =>
                    exportToSheetsOnGoogle(token, monthList, patients)
                );
                return res.status(200).json({ url });
            } catch (err) {
                if (err && err.isGoogleAuthError) {
                    return res.status(401).json({
                        error: 'Sua conexão com o Google expirou. Conecte novamente.',
                        code: 'GOOGLE_AUTH_REQUIRED'
                    });
                }
                throw err;
            }
        }

        // --------------------------------------------------------------------
        // D. CONTROLE DE PACOTES & VÍNCULO DE AGENDA (1 PARA N)
        // --------------------------------------------------------------------
        // GET /api/pacotes/overview?baseMonth=YYYY-MM
        if (pathname === '/api/pacotes/overview' && method === 'GET') {
            const baseMonth = parsedUrl.searchParams.get('baseMonth') || '';
            const win = getThreeMonthWindow(baseMonth);
            const today = getSaoPauloTodayStr();

            let calendarEvents = [];
            let googleConnected = Boolean(session && session.accessToken);
            let googleAuthExpired = false;
            let googleError = null;

            if (googleConnected) {
                try {
                    calendarEvents = await runWithGoogleSession(req, res, session, (token) =>
                        fetchDetailedEventsFromGoogle(token, win.startDate, win.endDate)
                    );
                } catch (err) {
                    console.error('Erro ao ler agenda para pacotes:', err);
                    if (err && err.isGoogleAuthError) {
                        googleConnected = false;
                        googleAuthExpired = true;
                        googleError = null;
                    } else {
                        googleError = err.message;
                    }
                }
            }

            const state = await syncAndDistributePackages(
                googleConnected && !googleError ? calendarEvents : null,
                win.startDate,
                win.endDate
            );

            return res.status(200).json({
                today,
                window: win,
                googleConnected,
                googleAuthExpired,
                googleError,
                events: calendarEvents,
                ...state
            });
        }

        // POST /api/pacotes/links  { paciente_id, calendar_names: string[] }
        if (pathname === '/api/pacotes/links' && method === 'POST') {
            const body = req.body || {};
            const pacienteId = (body.paciente_id || '').trim();
            const rawNames = Array.isArray(body.calendar_names)
                ? body.calendar_names
                : body.calendar_name
                    ? [body.calendar_name]
                    : [];

            const cleanNames = Array.from(
                new Set(rawNames.map(n => String(n || '').trim()).filter(Boolean))
            );

            if (!pacienteId || cleanNames.length === 0) {
                return res.status(400).send('paciente_id e calendar_names são obrigatórios.');
            }

            const rows = cleanNames.map(calendar_name => ({
                paciente_id: pacienteId,
                calendar_name
            }));

            const inserted = await supabaseRequest('patient_calendar_links', {
                method: 'POST',
                query: 'on_conflict=calendar_name',
                prefer: 'resolution=merge-duplicates,return=representation',
                body: rows
            });

            return res.status(200).json({ ok: true, links: inserted || [] });
        }

        // DELETE /api/pacotes/links/:id
        if (pathname.startsWith('/api/pacotes/links/') && method === 'DELETE') {
            const linkId = decodeURIComponent(pathname.replace('/api/pacotes/links/', '')).trim();
            if (linkId) {
                await supabaseRequest('patient_calendar_links', {
                    method: 'DELETE',
                    query: `id=eq.${encodeURIComponent(linkId)}`
                });
            }
            return res.status(200).json({ ok: true });
        }

        // POST /api/pacotes  (cria pacote e opcionalmente já anexa sessões selecionadas)
        if (pathname === '/api/pacotes' && method === 'POST') {
            const body = req.body || {};
            const pacienteId = (body.paciente_id || '').trim();
            const packageType = (body.package_type || '10').trim();
            const totalSessions = parseInt(body.total_sessions, 10);
            const sessionPrice = Number(body.session_price || 0);
            const startDate = body.start_date ? String(body.start_date).trim() : null;
            const initialOffset = Math.max(0, parseInt(body.initial_offset || 0, 10) || 0);
            const label = body.label ? String(body.label).trim() : null;
            const notes = body.notes ? String(body.notes).trim() : null;
            const isPaid = Boolean(body.is_paid);
            const attachEvents = Array.isArray(body.attach_events) ? body.attach_events : [];

            if (!pacienteId || !totalSessions || totalSessions <= 0) {
                return res.status(400).send('Paciente e quantidade total de sessões são obrigatórios.');
            }

            const initialStatus = initialOffset + attachEvents.length >= totalSessions ? 'completed' : 'active';

            const createdArr = await supabaseRequest('packages', {
                method: 'POST',
                prefer: 'return=representation',
                body: [{
                    paciente_id: pacienteId,
                    package_type: packageType,
                    label,
                    total_sessions: totalSessions,
                    session_price: isNaN(sessionPrice) ? 0 : sessionPrice,
                    start_date: startDate || null,
                    initial_offset: initialOffset,
                    status: initialStatus,
                    is_paid: isPaid,
                    notes
                }]
            });

            const createdPkg = Array.isArray(createdArr) ? createdArr[0] : createdArr;
            if (!createdPkg) {
                return res.status(500).send('Falha ao criar pacote no banco de dados.');
            }

            if (attachEvents.length > 0) {
                for (const ev of attachEvents) {
                    if (ev.eventId) {
                        await supabaseRequest('package_session_exclusions', {
                            method: 'DELETE',
                            query: `calendar_event_id=eq.${encodeURIComponent(ev.eventId)}`
                        }).catch(() => {});
                    }
                }

                const sessionRows = attachEvents
                    .filter(ev => ev.eventId && ev.date)
                    .map(ev => ({
                        package_id: createdPkg.id,
                        calendar_event_id: ev.eventId,
                        event_date: ev.date,
                        event_datetime: ev.eventDatetime || `${ev.date}T12:00:00-03:00`,
                        calendar_summary: ev.rawSummary || `#${ev.calendarName || 'Atendimento'}`,
                        calendar_name: ev.calendarName || ''
                    }));

                if (sessionRows.length > 0) {
                    await supabaseRequest('package_sessions', {
                        method: 'POST',
                        query: 'on_conflict=calendar_event_id',
                        prefer: 'resolution=merge-duplicates',
                        body: sessionRows
                    });
                }
            }

            await recalculatePackageStatuses(pacienteId);
            return res.status(200).json({ ok: true, package: createdPkg });
        }

        // PATCH /api/pacotes/:id
        if (pathname.startsWith('/api/pacotes/') && !pathname.includes('/sessions/') && !pathname.includes('/links/') && method === 'PATCH') {
            const pkgId = decodeURIComponent(pathname.replace('/api/pacotes/', '')).trim();
            const body = req.body || {};
            if (!pkgId) return res.status(400).send('ID do pacote é obrigatório.');

            const existingArr = await supabaseRequest('packages', {
                query: `select=*&id=eq.${encodeURIComponent(pkgId)}`
            });
            const existing = existingArr && existingArr[0];
            if (!existing) return res.status(404).send('Pacote não encontrado.');

            const updates = { updated_at: new Date().toISOString() };
            if (body.paciente_id !== undefined) {
                updates.paciente_id = body.paciente_id ? String(body.paciente_id).trim() : null;
            }
            if (body.package_type !== undefined) updates.package_type = body.package_type;
            if (body.label !== undefined) updates.label = body.label || null;
            if (body.total_sessions !== undefined) updates.total_sessions = Math.max(1, parseInt(body.total_sessions, 10) || 1);
            if (body.session_price !== undefined) updates.session_price = Number(body.session_price) || 0;
            if (body.start_date !== undefined) updates.start_date = body.start_date ? String(body.start_date).trim() : null;
            if (body.initial_offset !== undefined) updates.initial_offset = Math.max(0, parseInt(body.initial_offset, 10) || 0);
            if (body.is_paid !== undefined) updates.is_paid = Boolean(body.is_paid);
            if (body.notes !== undefined) updates.notes = body.notes || null;
            if (body.status !== undefined) updates.status = body.status;

            // Se mudou start_date para frente, remove sessões vinculadas anteriores à nova data
            if (updates.start_date && updates.start_date !== existing.start_date) {
                await supabaseRequest('package_sessions', {
                    method: 'DELETE',
                    query: `package_id=eq.${encodeURIComponent(pkgId)}&event_date=lt.${encodeURIComponent(updates.start_date)}`
                }).catch(() => {});
            }

            // Opcional: ao desvincular ou trocar o paciente titular, liberar todas as sessões deste pacote
            if (body.clear_sessions === true) {
                await supabaseRequest('package_sessions', {
                    method: 'DELETE',
                    query: `package_id=eq.${encodeURIComponent(pkgId)}`
                }).catch(() => {});
            }

            try {
                await supabaseRequest('packages', {
                    method: 'PATCH',
                    query: `id=eq.${encodeURIComponent(pkgId)}`,
                    body: updates
                });
            } catch (err) {
                const msg = String(err?.message || '');
                if (msg.includes('23502') || msg.includes('null value in column "paciente_id"')) {
                    return res.status(400).json({
                        error: 'Para desvincular o paciente de um pacote no banco de dados, execute no SQL Editor do Supabase: ALTER TABLE go_fechamento.packages ALTER COLUMN paciente_id DROP NOT NULL;'
                    });
                }
                throw err;
            }

            await recalculatePackageStatusesByIds([pkgId]);
            if (existing.paciente_id) await recalculatePackageStatuses(existing.paciente_id);
            if (updates.paciente_id && updates.paciente_id !== existing.paciente_id) {
                await recalculatePackageStatuses(updates.paciente_id);
            }
            return res.status(200).json({ ok: true });
        }

        // DELETE /api/pacotes/:id
        if (pathname.startsWith('/api/pacotes/') && !pathname.includes('/sessions/') && !pathname.includes('/links/') && method === 'DELETE') {
            const pkgId = decodeURIComponent(pathname.replace('/api/pacotes/', '')).trim();
            if (pkgId) {
                await supabaseRequest('packages', {
                    method: 'DELETE',
                    query: `id=eq.${encodeURIComponent(pkgId)}`
                });
            }
            return res.status(200).json({ ok: true });
        }

        // POST /api/pacotes/sessions/assign  { package_id, event }
        if (pathname === '/api/pacotes/sessions/assign' && method === 'POST') {
            const body = req.body || {};
            const packageId = (body.package_id || '').trim();
            const ev = body.event;
            if (!packageId || !ev || !ev.eventId || !ev.date) {
                return res.status(400).json({ error: 'package_id e event válido são obrigatórios.' });
            }

            const pkgArr = await supabaseRequest('packages', {
                query: `select=id,paciente_id,start_date&id=eq.${encodeURIComponent(packageId)}`
            });
            const pkg = pkgArr && pkgArr[0];
            if (!pkg) return res.status(404).json({ error: 'Pacote não encontrado.' });

            // Verifica se o evento já pertence a outro pacote
            const existingSessArr = await supabaseRequest('package_sessions', {
                query: `select=id,package_id&calendar_event_id=eq.${encodeURIComponent(ev.eventId)}`
            }).catch(() => []);
            const existingSess = existingSessArr && existingSessArr[0];
            if (existingSess && existingSess.package_id !== packageId) {
                return res.status(409).json({ error: 'Este atendimento já está vinculado a outro pacote.' });
            }

            // Se pacote estava sem data de início, define pela data deste atendimento
            if (!pkg.start_date) {
                await supabaseRequest('packages', {
                    method: 'PATCH',
                    query: `id=eq.${encodeURIComponent(packageId)}`,
                    body: { start_date: ev.date, updated_at: new Date().toISOString() }
                }).catch(() => {});
            }

            // Remove de exclusões caso estivesse marcado como pendente ou ignorado
            await supabaseRequest('package_session_exclusions', {
                method: 'DELETE',
                query: `calendar_event_id=eq.${encodeURIComponent(ev.eventId)}`
            }).catch(() => {});

            await supabaseRequest('package_sessions', {
                method: 'POST',
                query: 'on_conflict=calendar_event_id',
                prefer: 'resolution=merge-duplicates',
                body: [{
                    package_id: packageId,
                    calendar_event_id: ev.eventId,
                    event_date: ev.date,
                    event_datetime: ev.eventDatetime || `${ev.date}T12:00:00-03:00`,
                    calendar_summary: ev.rawSummary || `#${ev.calendarName || ''}`,
                    calendar_name: ev.calendarName || ''
                }]
            });

            await recalculatePackageStatusesByIds([packageId]);
            return res.status(200).json({ ok: true });
        }

        // POST /api/pacotes/sessions/replace  { package_id, old_calendar_event_id, new_event }
        if (pathname === '/api/pacotes/sessions/replace' && method === 'POST') {
            const body = req.body || {};
            const packageId = (body.package_id || '').trim();
            const oldCalendarEventId = (body.old_calendar_event_id || '').trim();
            const ev = body.new_event;

            if (!packageId || !oldCalendarEventId || !ev || !ev.eventId || !ev.date) {
                return res.status(400).json({ error: 'package_id, old_calendar_event_id e new_event válido são obrigatórios.' });
            }

            if (oldCalendarEventId === ev.eventId) {
                return res.status(200).json({ ok: true });
            }

            const pkgArr = await supabaseRequest('packages', {
                query: `select=id,paciente_id,start_date&id=eq.${encodeURIComponent(packageId)}`
            });
            const pkg = pkgArr && pkgArr[0];
            if (!pkg) return res.status(404).json({ error: 'Pacote não encontrado.' });

            const existingNewArr = await supabaseRequest('package_sessions', {
                query: `select=id,package_id&calendar_event_id=eq.${encodeURIComponent(ev.eventId)}`
            }).catch(() => []);
            const existingNew = existingNewArr && existingNewArr[0];
            if (existingNew && existingNew.package_id !== packageId) {
                return res.status(409).json({ error: 'Este atendimento já está vinculado a outro pacote.' });
            }

            const oldSessArr = await supabaseRequest('package_sessions', {
                query: `select=id,event_date,calendar_summary&calendar_event_id=eq.${encodeURIComponent(oldCalendarEventId)}&package_id=eq.${encodeURIComponent(packageId)}`
            }).catch(() => []);
            const oldSess = oldSessArr && oldSessArr[0];

            // Remove a sessão antiga e marca como pendente em package_session_exclusions
            // para impedir auto-distribuição automática de reanexá-la no reload
            await supabaseRequest('package_sessions', {
                method: 'DELETE',
                query: `calendar_event_id=eq.${encodeURIComponent(oldCalendarEventId)}&package_id=eq.${encodeURIComponent(packageId)}`
            });

            await supabaseRequest('package_session_exclusions', {
                method: 'POST',
                query: 'on_conflict=calendar_event_id',
                prefer: 'resolution=merge-duplicates',
                body: [{
                    calendar_event_id: oldCalendarEventId,
                    paciente_id: pkg.paciente_id || null,
                    event_date: oldSess?.event_date || null,
                    calendar_summary: oldSess?.calendar_summary || null,
                    status: 'pending',
                    reason: 'replaced_in_package'
                }]
            }).catch(() => {});

            // Remove exclusão do novo evento caso estivesse pendente ou ignorado
            await supabaseRequest('package_session_exclusions', {
                method: 'DELETE',
                query: `calendar_event_id=eq.${encodeURIComponent(ev.eventId)}`
            }).catch(() => {});

            await supabaseRequest('package_sessions', {
                method: 'POST',
                query: 'on_conflict=calendar_event_id',
                prefer: 'resolution=merge-duplicates',
                body: [{
                    package_id: packageId,
                    calendar_event_id: ev.eventId,
                    event_date: ev.date,
                    event_datetime: ev.eventDatetime || `${ev.date}T12:00:00-03:00`,
                    calendar_summary: ev.rawSummary || `#${ev.calendarName || ''}`,
                    calendar_name: ev.calendarName || ''
                }]
            });

            if (!pkg.start_date) {
                await supabaseRequest('packages', {
                    method: 'PATCH',
                    query: `id=eq.${encodeURIComponent(packageId)}`,
                    body: { start_date: ev.date, updated_at: new Date().toISOString() }
                }).catch(() => {});
            }

            await recalculatePackageStatusesByIds([packageId]);
            return res.status(200).json({ ok: true });
        }

        // POST /api/pacotes/sessions/detach  (tira sessão do pacote e deixa o dia pendente)
        if (pathname === '/api/pacotes/sessions/detach' && method === 'POST') {
            const body = req.body || {};
            const calendarEventId = (body.calendar_event_id || '').trim();
            const pacienteId = body.paciente_id ? String(body.paciente_id).trim() : null;
            const eventDate = body.event_date ? String(body.event_date).trim() : null;
            const calendarSummary = body.calendar_summary ? String(body.calendar_summary).trim() : null;

            if (!calendarEventId) {
                return res.status(400).send('calendar_event_id é obrigatório.');
            }

            const prevSessArr = await supabaseRequest('package_sessions', {
                query: `select=package_id&calendar_event_id=eq.${encodeURIComponent(calendarEventId)}`
            }).catch(() => []);
            const oldPkgId = prevSessArr?.[0]?.package_id || null;

            await supabaseRequest('package_sessions', {
                method: 'DELETE',
                query: `calendar_event_id=eq.${encodeURIComponent(calendarEventId)}`
            });

            await supabaseRequest('package_session_exclusions', {
                method: 'POST',
                query: 'on_conflict=calendar_event_id',
                prefer: 'resolution=merge-duplicates',
                body: [{
                    calendar_event_id: calendarEventId,
                    paciente_id: pacienteId,
                    event_date: eventDate,
                    calendar_summary: calendarSummary,
                    status: 'pending',
                    reason: 'removed_from_package'
                }]
            });

            await recalculatePackageStatusesByIds([oldPkgId]);
            if (pacienteId) await recalculatePackageStatuses(pacienteId);
            return res.status(200).json({ ok: true });
        }

        // POST /api/pacotes/sessions/move  { calendar_event_id, target_package_id }
        if (pathname === '/api/pacotes/sessions/move' && method === 'POST') {
            const body = req.body || {};
            const calendarEventId = (body.calendar_event_id || '').trim();
            const targetPackageId = (body.target_package_id || '').trim();
            if (!calendarEventId || !targetPackageId) {
                return res.status(400).send('calendar_event_id e target_package_id são obrigatórios.');
            }

            const pkgArr = await supabaseRequest('packages', {
                query: `select=id,paciente_id&id=eq.${encodeURIComponent(targetPackageId)}`
            });
            const targetPkg = pkgArr && pkgArr[0];
            if (!targetPkg) return res.status(404).send('Pacote de destino não encontrado.');

            const prevSessArr = await supabaseRequest('package_sessions', {
                query: `select=package_id&calendar_event_id=eq.${encodeURIComponent(calendarEventId)}`
            }).catch(() => []);
            const oldPkgId = prevSessArr?.[0]?.package_id || null;

            await supabaseRequest('package_session_exclusions', {
                method: 'DELETE',
                query: `calendar_event_id=eq.${encodeURIComponent(calendarEventId)}`
            }).catch(() => {});

            await supabaseRequest('package_sessions', {
                method: 'PATCH',
                query: `calendar_event_id=eq.${encodeURIComponent(calendarEventId)}`,
                body: { package_id: targetPackageId }
            });

            await recalculatePackageStatusesByIds([oldPkgId, targetPackageId]);
            return res.status(200).json({ ok: true });
        }

        // POST /api/pacotes/sessions/ignore
        if (pathname === '/api/pacotes/sessions/ignore' && method === 'POST') {
            const body = req.body || {};
            const calendarEventId = (body.calendar_event_id || '').trim();
            if (!calendarEventId) return res.status(400).send('calendar_event_id é obrigatório.');

            await supabaseRequest('package_sessions', {
                method: 'DELETE',
                query: `calendar_event_id=eq.${encodeURIComponent(calendarEventId)}`
            }).catch(() => {});

            await supabaseRequest('package_session_exclusions', {
                method: 'POST',
                query: 'on_conflict=calendar_event_id',
                prefer: 'resolution=merge-duplicates',
                body: [{
                    calendar_event_id: calendarEventId,
                    paciente_id: body.paciente_id || null,
                    event_date: body.event_date || null,
                    calendar_summary: body.calendar_summary || null,
                    status: 'ignored',
                    reason: body.reason || 'ignored'
                }]
            });

            await recalculatePackageStatuses(body.paciente_id || null);
            return res.status(200).json({ ok: true });
        }

        // DELETE /api/pacotes/sessions/ignore/:eventId (restaurar atendimento ignorado)
        if (pathname.startsWith('/api/pacotes/sessions/ignore/') && method === 'DELETE') {
            const eventId = decodeURIComponent(pathname.replace('/api/pacotes/sessions/ignore/', '')).trim();
            if (eventId) {
                await supabaseRequest('package_session_exclusions', {
                    method: 'DELETE',
                    query: `calendar_event_id=eq.${encodeURIComponent(eventId)}`
                });
            }
            return res.status(200).json({ ok: true });
        }

        // --------------------------------------------------------------------
        // E. VISUALIZADOR DA SEMANA (AGENDA GOOGLE #)
        // --------------------------------------------------------------------
        // GET /api/agenda/semana?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
        if (pathname === '/api/agenda/semana' && method === 'GET') {
            const today = getSaoPauloTodayStr();
            const reqStart = (parsedUrl.searchParams.get('startDate') || '').trim();
            const reqEnd = (parsedUrl.searchParams.get('endDate') || '').trim();
            const isoRe = /^\d{4}-\d{2}-\d{2}$/;

            let startDate = isoRe.test(reqStart) ? reqStart : '';
            let endDate = isoRe.test(reqEnd) ? reqEnd : '';

            if (!startDate || !endDate) {
                const [y, m, d] = today.split('-').map(Number);
                const ref = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
                const dow = ref.getUTCDay();
                const diffToMonday = dow === 0 ? -6 : 1 - dow;
                const monday = new Date(ref);
                monday.setUTCDate(ref.getUTCDate() + diffToMonday);
                const sunday = new Date(monday);
                sunday.setUTCDate(monday.getUTCDate() + 6);
                startDate = startDate || monday.toISOString().slice(0, 10);
                endDate = endDate || sunday.toISOString().slice(0, 10);
            }

            if (endDate < startDate) {
                return res.status(400).json({ error: 'endDate deve ser maior ou igual a startDate.' });
            }

            let googleConnected = Boolean(session && session.accessToken);
            let googleAuthExpired = false;
            let googleError = null;
            let events = [];

            if (googleConnected) {
                try {
                    events = await runWithGoogleSession(req, res, session, (token) =>
                        fetchDetailedEventsFromGoogle(token, startDate, endDate)
                    );
                } catch (err) {
                    console.error('Erro ao carregar agenda semanal:', err);
                    if (err && err.isGoogleAuthError) {
                        googleConnected = false;
                        googleAuthExpired = true;
                        googleError = null;
                    } else {
                        googleError = err.message;
                    }
                }
            }

            const mappings = await supabaseRequest('patient_name_mappings', {
                query: 'select=month_key,old_name,new_name'
            }).catch(() => []);

            return res.status(200).json({
                today,
                startDate,
                endDate,
                googleConnected,
                googleAuthExpired,
                googleError,
                events,
                mappings: mappings || []
            });
        }

        return res.status(404).json({ error: `Rota não encontrada: ${method} ${pathname}` });
    } catch (err) {
        console.error('Erro na API:', err);
        return res.status(500).send(`Erro interno no servidor: ${err.message}`);
    }
};
