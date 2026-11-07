// Tratamento de valores monetários/quantidades (colunas Decimal(10,2)).
//
// Todo valor que entra pela API passa por `parseCentavos`, que devolve um
// número inteiro de centavos (sem erro de ponto flutuante) ou null quando o
// valor é inválido. Nunca truncamos silenciosamente: "7,05" vira 705 centavos
// e "abc" / "1,234.56" / "12abc" são recusados.
//
// Formatos aceitos (string), com sinal "-" opcional quando permitido:
//   1234        1234,5      1234,56      (vírgula decimal, padrão BR)
//   1234.5      1234.56                  (ponto decimal, padrão antigo da tela)
//   1.234,56    1.234.567,89             (milhar com ponto + vírgula decimal)
//   1.234.567                            (milhar com 2+ grupos, sem centavos)
// Recusados por ambiguidade: "1.234" (mil? ou 1,234?) — o usuário deve
// escrever "1.234,00" ou "1234".
// Números (JSON) também são aceitos, desde que tenham no máximo 2 casas.

// Maior valor que cabe em Decimal(10,2): 99.999.999,99.
export const MAX_CENTAVOS = 9_999_999_999;

const RE_VIRGULA = /^\d+(,\d{1,2})?$/;
const RE_PONTO = /^\d+(\.\d{1,2})?$/;
const RE_MILHAR_VIRGULA = /^\d{1,3}(\.\d{3})+,\d{1,2}$/;
const RE_MILHAR_SEM_CENTAVOS = /^\d{1,3}(\.\d{3}){2,}$/;

function stringParaCentavos(texto: string): number | null {
    let s = texto.replace(/^R\$/i, "").replace(/\s+/g, "");
    let negativo = false;
    if (s.startsWith("-")) {
        negativo = true;
        s = s.slice(1);
    }

    // Separa parte inteira e centavos pelo separador decimal informado.
    const dividir = (sep: string): [string, string] => {
        const [i = "", f = ""] = s.split(sep);
        return [i, f];
    };

    let inteiro: string;
    let fracao = "";
    if (RE_VIRGULA.test(s)) {
        [inteiro, fracao] = dividir(",");
    } else if (RE_PONTO.test(s)) {
        [inteiro, fracao] = dividir(".");
    } else if (RE_MILHAR_VIRGULA.test(s)) {
        [inteiro, fracao] = dividir(",");
        inteiro = inteiro.replace(/\./g, "");
    } else if (RE_MILHAR_SEM_CENTAVOS.test(s)) {
        inteiro = s.replace(/\./g, "");
    } else {
        return null;
    }

    if (inteiro.length > 12) return null; // evita perda de precisão
    const centavos = Number(inteiro) * 100 + Number(fracao.padEnd(2, "0"));
    return negativo ? -centavos : centavos;
}

export function parseCentavos(
    valor: unknown,
    opcoes: { permitirNegativo?: boolean } = {},
): number | null {
    let centavos: number | null = null;

    if (typeof valor === "number") {
        if (!Number.isFinite(valor)) return null;
        const c = Math.round(valor * 100);
        // mais de 2 casas decimais (ex: 0.001) é recusado, não arredondado
        if (Math.abs(valor * 100 - c) > 1e-6) return null;
        centavos = c;
    } else if (typeof valor === "string") {
        centavos = stringParaCentavos(valor.trim());
    }

    if (centavos === null) return null;
    if (Object.is(centavos, -0)) centavos = 0;
    if (!opcoes.permitirNegativo && centavos < 0) return null;
    if (Math.abs(centavos) > MAX_CENTAVOS) return null;
    return centavos;
}

// Centavos → string decimal exata para o Prisma/MySQL ("1234.56", "-0.05").
export function centavosParaDecimal(centavos: number): string {
    const negativo = centavos < 0;
    const abs = Math.abs(centavos);
    const texto = `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
    return negativo ? `-${texto}` : texto;
}

// Valor Decimal vindo do banco (Prisma.Decimal) → centavos inteiros.
export function decimalParaCentavos(valor: { toString(): string } | null | undefined): number {
    if (valor === null || valor === undefined) return 0;
    const c = stringParaCentavos(valor.toString());
    if (c === null) throw new Error(`Valor decimal inesperado: ${valor}`);
    return c;
}

// Total = quantidade × preço, ambos em centavos, arredondado ao centavo
// (meio para cima). Feito em BigInt: o produto de dois valores grandes passa
// de 2^53 e perderia precisão em Number.
export function multiplicarCentavos(qtdCentavos: number, precoCentavos: number): number {
    const produto = BigInt(qtdCentavos) * BigInt(precoCentavos); // escala 10^4
    return Number((produto + 50n) / 100n);
}

export const MSG_VALOR_INVALIDO =
    "use um número com até 2 casas decimais (ex: 1.234,56 ou 1234.56)";
