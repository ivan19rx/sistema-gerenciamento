// Identificação do dispositivo que fez o login, a partir do User-Agent e das
// "client hints" que o navegador informa (enviadas pelo frontend no corpo do
// login, em `dispositivo`).
//
// O User-Agent sozinho é pouco preciso hoje: o Chrome congelou a versão do
// sistema (Windows 11 aparece como "Windows NT 10.0") e esconde o modelo do
// celular Android ("K"). As client hints trazem esses dados de verdade.
// Tudo que vem do cliente é tratado como não confiável: só textos curtos são
// aceitos, e o resultado serve para exibição, nunca para segurança.

export type TipoDispositivo = "COMPUTADOR" | "CELULAR" | "TABLET" | "DESCONHECIDO";

export interface Dispositivo {
    tipo: TipoDispositivo;
    sistema: string | null;
    navegador: string | null;
    modelo: string | null;
}

// Dados opcionais enviados pelo navegador (navigator.userAgentData etc.).
interface DicasCliente {
    plataforma?: string | undefined;
    versaoPlataforma?: string | undefined;
    modelo?: string | undefined;
    mobile?: boolean | undefined;
    marcas?: { marca: string; versao: string }[] | undefined;
    // navigator.maxTouchPoints > 1 — distingue iPad (que se diz "Macintosh")
    toque?: boolean | undefined;
}

const texto = (v: unknown, max = 60): string | undefined => {
    if (typeof v !== "string") return undefined;
    // eslint-disable-next-line no-control-regex
    const limpo = v.replace(/[\u0000-\u001f\u007f]/g, "").trim();
    return limpo && limpo.length <= max ? limpo : undefined;
};

// Normaliza o objeto `dispositivo` do corpo do login (ignora o que for estranho).
export function lerDicasCliente(bruto: unknown): DicasCliente {
    if (!bruto || typeof bruto !== "object") return {};
    const o = bruto as Record<string, unknown>;
    const marcas = Array.isArray(o.marcas)
        ? o.marcas
              .slice(0, 10)
              .map((m) => {
                  const r = (m ?? {}) as Record<string, unknown>;
                  const marca = texto(r.marca);
                  const versao = texto(r.versao, 20);
                  return marca ? { marca, versao: versao ?? "" } : null;
              })
              .filter((m): m is { marca: string; versao: string } => m !== null)
        : undefined;
    return {
        plataforma: texto(o.plataforma),
        versaoPlataforma: texto(o.versaoPlataforma, 20),
        modelo: texto(o.modelo, 100),
        mobile: typeof o.mobile === "boolean" ? o.mobile : undefined,
        toque: typeof o.toque === "boolean" ? o.toque : undefined,
        marcas,
    };
}

const maior = (versao: string | undefined) => {
    const n = parseInt(versao ?? "", 10);
    return Number.isFinite(n) ? n : null;
};

// ── Sistema operacional ─────────────────────────────────────────────────────
function sistemaPorUA(ua: string): string | null {
    let r: RegExpExecArray | null;
    if ((r = /Windows NT (\d+\.\d+)/.exec(ua))) {
        const mapa: Record<string, string> = {
            "10.0": "Windows 10/11", "6.3": "Windows 8.1", "6.2": "Windows 8",
            "6.1": "Windows 7",
        };
        return mapa[r[1]!] ?? "Windows";
    }
    if (/iPad/.test(ua)) {
        r = /OS (\d+)[_.](\d+)/.exec(ua);
        return r ? `iPadOS ${r[1]}.${r[2]}` : "iPadOS";
    }
    if (/iPhone|iPod/.test(ua)) {
        r = /OS (\d+)[_.](\d+)/.exec(ua);
        return r ? `iOS ${r[1]}.${r[2]}` : "iOS";
    }
    // Chrome novo manda sempre "Android 10; K" (versão e modelo congelados).
    if (/Android 10; K\)/.test(ua)) return "Android";
    if ((r = /Android (\d+(?:\.\d+)?)/.exec(ua))) return `Android ${r[1]}`;
    if (/Android/.test(ua)) return "Android";
    if (/CrOS/.test(ua)) return "ChromeOS";
    // Safari e Chrome congelaram em "10_15_7": esse número não diz a versão real.
    if ((r = /Mac OS X (\d+)[_.](\d+)/.exec(ua)) && !(r[1] === "10" && r[2] === "15")) {
        return `macOS ${r[1]}.${r[2]}`;
    }
    if (/Macintosh/.test(ua)) return "macOS";
    if (/Linux/.test(ua)) return "Linux";
    return null;
}

function sistemaPorDicas(d: DicasCliente): string | null {
    const p = d.plataforma;
    const v = maior(d.versaoPlataforma);
    if (!p) return null;
    if (p === "Windows") {
        // platformVersion >= 13 é Windows 11; 1–10 é Windows 10.
        if (v === null) return "Windows";
        if (v >= 13) return "Windows 11";
        if (v > 0) return "Windows 10";
        return "Windows (anterior ao 10)";
    }
    if (p === "macOS") return d.versaoPlataforma ? `macOS ${d.versaoPlataforma.split(".").slice(0, 2).join(".")}` : "macOS";
    if (p === "Android") return d.versaoPlataforma ? `Android ${d.versaoPlataforma.split(".")[0]}` : "Android";
    if (p === "Chrome OS" || p === "Chromium OS") return "ChromeOS";
    if (p === "Linux") return "Linux";
    return p;
}

// ── Navegador ───────────────────────────────────────────────────────────────
function navegadorPorUA(ua: string): string | null {
    const regras: [RegExp, string][] = [
        [/EdgA?\/(\d+)/, "Edge"],
        [/EdgiOS\/(\d+)/, "Edge"],
        [/OPR\/(\d+)/, "Opera"],
        [/OPX\/(\d+)/, "Opera"],
        [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
        [/YaBrowser\/(\d+)/, "Yandex"],
        [/FxiOS\/(\d+)/, "Firefox"],
        [/Firefox\/(\d+)/, "Firefox"],
        [/CriOS\/(\d+)/, "Chrome"],
        [/Chrome\/(\d+)/, "Chrome"],
        [/Version\/(\d+)(?:\.\d+)*.*Safari/, "Safari"],
    ];
    for (const [re, nome] of regras) {
        const r = re.exec(ua);
        if (r) return `${nome} ${r[1]}`;
    }
    return null;
}

function navegadorPorDicas(d: DicasCliente): string | null {
    if (!d.marcas?.length) return null;
    // Marcas "de verdade" primeiro; "Chromium" só se não houver outra.
    const ordem = ["Microsoft Edge", "Opera", "Brave", "Vivaldi", "Samsung Internet", "Yandex", "Google Chrome"];
    for (const nome of ordem) {
        const m = d.marcas.find((x) => x.marca === nome);
        if (m) {
            const curto = nome.replace(/^Microsoft /, "").replace(/^Google /, "");
            const v = maior(m.versao);
            return v ? `${curto} ${v}` : curto;
        }
    }
    return null;
}

// ── Tipo de aparelho ────────────────────────────────────────────────────────
function tipoPorUA(ua: string, d: DicasCliente): TipoDispositivo {
    if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua)) return "TABLET";
    // iPadOS 13+ se apresenta como Mac; a diferença é a tela de toque.
    if (/Macintosh/.test(ua) && d.toque) return "TABLET";
    if (/Android/.test(ua)) return /Mobile/.test(ua) || d.mobile ? "CELULAR" : "TABLET";
    if (/iPhone|iPod|Mobile|Windows Phone|Opera Mini/i.test(ua) || d.mobile) return "CELULAR";
    if (/Windows NT|Macintosh|X11|Linux|CrOS/.test(ua)) return "COMPUTADOR";
    return "DESCONHECIDO";
}

function modeloPorUA(ua: string): string | null {
    if (/iPhone/.test(ua)) return "iPhone";
    if (/iPad/.test(ua)) return "iPad";
    // "Android 14; SM-S911B Build/..." → SM-S911B (o Chrome novo manda só "K")
    const r = /Android [\d.]+; ([^;)]+?)(?: Build\/|\))/.exec(ua);
    const modelo = r?.[1]?.trim();
    if (modelo && modelo !== "K" && !/^wv$/i.test(modelo)) return modelo;
    return null;
}

export function identificarDispositivo(userAgent: string | undefined, dicasBrutas: unknown): Dispositivo {
    const ua = userAgent ?? "";
    const d = lerDicasCliente(dicasBrutas);
    const tipo = ua ? tipoPorUA(ua, d) : d.mobile ? "CELULAR" : "DESCONHECIDO";

    let modelo = d.modelo || modeloPorUA(ua);
    if (!modelo && tipo === "TABLET" && /Macintosh/.test(ua)) modelo = "iPad";

    return {
        tipo,
        sistema: (tipo === "TABLET" && /Macintosh/.test(ua) ? "iPadOS" : null)
            ?? sistemaPorDicas(d) ?? sistemaPorUA(ua),
        navegador: navegadorPorDicas(d) ?? navegadorPorUA(ua),
        modelo: modelo ?? null,
    };
}

// IP de quem fez a requisição. Com TRUST_PROXY configurado, o Express já
// resolve o IP real a partir do X-Forwarded-For.
export function ipDaRequisicao(ip: string | undefined): string | null {
    if (!ip) return null;
    const limpo = ip.replace(/^::ffff:/, "");
    return limpo.slice(0, 64);
}
