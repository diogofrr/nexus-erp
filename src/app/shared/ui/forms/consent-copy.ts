import type { ConsentKey } from '@core/models';

/**
 * Texto de cada consentimento em linguagem simples (UX 6.6): mesmo esqueleto nos seis, frases de até
 * 20 palavras, sem "titular dos dados" nem "tratamento". Uma pessoa de 14 anos entende sem ajuda.
 */
export interface ConsentCopy {
  /** Título em pergunta, uma linha. */
  question: string;
  /** O que vamos fazer. */
  what: string;
  /** Por quê. */
  why: string;
  /** Quem vê. */
  who: string;
  /** Se você disser não. */
  ifNo: string;
  /** Se mudar de ideia. */
  change: string;
}

export const CONSENT_COPY: Readonly<Record<ConsentKey, ConsentCopy>> = {
  health_data: {
    question: 'Podemos usar seus dados de saúde para cuidar de você?',
    what: 'Guardar suas respostas à escala de cansaço do cuidador, as anotações do acompanhamento psicológico e os avisos que surgirem.',
    why: 'Para a equipe de psicologia acompanhar você de perto e agir cedo se o cansaço aumentar.',
    who: 'O psicólogo que acompanha você e o responsável técnico. A gestão só vê números somados, sem o seu nome.',
    ifNo: 'O plano Livre e a agenda continuam. A escala e o atendimento clínico não acontecem.',
    change:
      'Você pode retirar o consentimento quando quiser. O registro psicológico já feito é guardado por 5 anos, conforme a norma do conselho (a confirmar).',
  },
  people_analytics: {
    question: 'Podemos incluir você nos números somados da Nexus?',
    what: 'Contar você, sem o seu nome, nos painéis que mostram como a Nexus está cuidando de todos.',
    why: 'Para a Nexus saber o que está funcionando e onde melhorar.',
    who: 'A gestão, só em totais de grupos com 5 pessoas ou mais.',
    ifNo: 'Você fica fora desses números. Nada mais muda.',
    change: 'Você pode retirar quando quiser. A partir daí, você sai dos números somados.',
  },
  family_sharing: {
    question: 'Podemos compartilhar informações da pessoa idosa com a sua família?',
    what: 'Mostrar a familiares que você indicar os dados organizados da pessoa idosa, item a item.',
    why: 'Para a família dividir o cuidado com você.',
    who: 'Só as pessoas que você escolher.',
    ifNo: 'Nada é compartilhado. O plano Livre continua.',
    change: 'Você pode desfazer o compartilhamento quando quiser.',
  },
  image_testimony: {
    question: 'Podemos usar sua imagem ou seu depoimento na comunicação da Nexus?',
    what: 'Mostrar sua foto ou sua fala em materiais da Nexus, só se você autorizar em documento próprio.',
    why: 'Para outras pessoas que cuidam conhecerem a Nexus.',
    who: 'Quem vir os materiais divulgados.',
    ifNo: 'Nenhuma imagem nem depoimento é usado. É opcional e não muda o plano.',
    change: 'Você pode retirar quando quiser. Os materiais são marcados para sair de circulação.',
  },
  whatsapp_contact: {
    question: 'Podemos falar com você pelo WhatsApp?',
    what: 'Enviar lembretes e perguntar como foi o atendimento por WhatsApp.',
    why: 'Porque é o canal mais prático para muita gente.',
    who: 'A equipe de atendimento da Nexus.',
    ifNo: 'Falamos por aplicativo, telefone ou e-mail. É opcional e não muda o plano.',
    change: 'Você pode retirar quando quiser. O canal volta a ser o aplicativo.',
  },
  pilot_tcle: {
    question: 'Você aceita participar do piloto da Nexus?',
    what: 'Responder a escala de cansaço no início e a cada 3 meses, durante 6 meses.',
    why: 'Para a Nexus acompanhar como as pessoas se sentem ao longo do tempo.',
    who: 'A equipe de psicologia e, em números somados, a gestão.',
    ifNo: 'Você continua com o seu plano normalmente.',
    change: 'Você pode sair do piloto quando quiser. Os dados já coletados seguem as regras de guarda.',
  },
};
