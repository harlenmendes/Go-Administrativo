import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export const exportarProntuarioParaPDF = async (
  elementId: string,
  nomePaciente: string,
  filePrefix = 'Prontuario'
) => {
  try {
    const element = document.getElementById(elementId)
    if (!element) {
      throw new Error('Elemento não encontrado para exportação')
    }

    // Prepara o elemento para impressão
    const originalStyle = element.style.cssText
    element.style.height = 'auto'
    element.style.overflow = 'visible'
    
    // Esconde botões indesejados durante o print
    const buttonsToHide = element.querySelectorAll('button')
    buttonsToHide.forEach(btn => {
      btn.setAttribute('data-original-display', btn.style.display || '')
      btn.style.display = 'none'
    })

    // Captura o elemento HTML como um canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowHeight: element.scrollHeight,
      onclone: (documentClone) => {
        // Remove a classe sticky do TopBar no clone para evitar sobreposição
        const headers = documentClone.querySelectorAll('header.sticky')
        headers.forEach(h => h.classList.remove('sticky', 'top-0', 'z-40'))
      }
    })

    // Restaura botões
    buttonsToHide.forEach(btn => {
      btn.style.display = btn.getAttribute('data-original-display') || ''
      btn.removeAttribute('data-original-display')
    })
    
    element.style.cssText = originalStyle

    const imgData = canvas.toDataURL('image/png')
    
    // Calcula as dimensões do PDF em formato A4
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width

    // Adiciona a imagem no PDF
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)

    // Nomeia o arquivo com o nome do paciente e data atual
    const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
    const nomeArquivo = `${filePrefix}_${nomePaciente.replace(/\s+/g, '_')}_${dataAtual}.pdf`

    // Dispara o download
    pdf.save(nomeArquivo)
    
    return true
  } catch (error) {
    console.error('Erro ao exportar PDF:', error)
    return false
  }
}
