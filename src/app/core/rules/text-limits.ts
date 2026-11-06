/**
 * Limite de tamanho dos textos livres do aplicativo do cuidador e dos cadastros (QAC-015). O armazenamento do navegador
 * é pequeno (cerca de 5 MB) e um texto de 10 mil caracteres não é uma anotação: é um erro de colagem. Os limites ficam
 * aqui, em constantes, para a regra e as telas dizerem o mesmo número e para mudar em um lugar só.
 *
 * - Nomes e títulos (nome de pessoa, título de compromisso, nome de remédio, assunto, endereço): 120 caracteres, o mesmo
 *   que o Começar já usava no nome.
 * - Textos de pedido e de mensagem (necessidade do pedido de serviço, mensagem à equipe, pedido de revisão, comentário
 *   da avaliação): 500 caracteres.
 */

/** Nomes e títulos curtos. */
export const NAME_MAX_CHARS = 120;
/** Texto de pedido ou de mensagem. */
export const FREE_TEXT_MAX_CHARS = 500;

/** O texto, sem espaços nas pontas, passa do limite? */
export function isTooLong(text: string, max: number): boolean {
  return text.trim().length > max;
}

/** Frase para a tela junto do campo ("Escreva até 120 caracteres."). */
export function tooLongText(max: number): string {
  return `Escreva até ${max} caracteres.`;
}

/** Frase para a tela quando a data digitada não existe (30/02, 31/04): junto do campo, sem culpar a pessoa (QAC-015). */
export const INVALID_DATE_TEXT = 'Escolha uma data que exista.';
