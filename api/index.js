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
    if (process.env.APP_BASE_URL) {
        return process.env.APP_BASE_URL.replace(/\/$/, '');
    }
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    return `${proto}://${host}`;
}

function isSecureRequest(req) {
    const proto = req.headers['x-forwarded-proto'] || '';
    return proto.includes('https') || process.env.NODE_ENV === 'production';
}

async function getValidSession(req, res) {
    const cookies = parseCookies(req);
    const session = decryptSession(cookies[COOKIE_NAME]);
    if (!session || !session.accessToken) return null;

    // Se o token estiver prestes a expirar e tivermos refreshToken, renova automaticamente
    if (session.expiresAt && Date.now() > session.expiresAt - 60000 && session.refreshToken) {
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
            if (tokenRes.ok) {
                const tokenData = await tokenRes.json();
                session.accessToken = tokenData.access_token;
                session.expiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;
                const secure = isSecureRequest(req);
                res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, encryptSession(session), {
                    httpOnly: true,
                    secure,
                    sameSite: 'Lax',
                    path: '/',
                    maxAge: 60 * 60 * 24 * 30 // 30 dias
                }));
            }
        } catch (e) {
            console.error('Erro ao renovar token Google:', e);
        }
    }

    return session;
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

async function supabaseRequest(table, { method = 'GET', query = '', body = null, prefer = '' } = {}) {
    const cfg = getSupabaseConfig();
    if (!cfg) return null;

    const headers = {
        'apikey': cfg.key,
        'Authorization': `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
        'Accept-Profile': cfg.schema,
        'Content-Profile': cfg.schema
    };
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
                throw new Error(`Falha na API do Google Calendar (${response.status}): ${errText}`);
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
        throw new Error(`Erro ao criar planilha (${createRes.status}): ${errText}`);
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
                prompt: 'select_account',
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

            const data = await fetchAtendimentosFromGoogle(session.accessToken, monthList);
            return res.status(200).json(data);
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
            const url = await exportToSheetsOnGoogle(session.accessToken, monthList, patients);
            return res.status(200).json({ url });
        }

        return res.status(404).json({ error: `Rota não encontrada: ${method} ${pathname}` });
    } catch (err) {
        console.error('Erro na API:', err);
        return res.status(500).send(`Erro interno no servidor: ${err.message}`);
    }
};
