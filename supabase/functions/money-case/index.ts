// @ts-nocheck
// Supabase Edge Function: money-case
// POST /money-case - Create a money case and generate Rail Pack
// GET /money-case?case_id=<id> - Fetch case with Rail Pack
// Returns: { ok, case_id, rail_pack }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-device-id, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ENDPOINT = "money-case";
const VERBOSE = Deno.env.get("VERBOSE_LOGGING") === "true";
const MONEY_CASE_RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_MINUTES = 60;

interface MoneyCaseInput {
  share_token?: string;
  issue_type: string;
  amount_cents?: number;
  currency?: string;
  transaction_date?: string;
  payment_method?: string;
  merchant_name?: string;
  merchant_url?: string;
  description?: string;
  desired_outcome?: string;
  locale?: string;
}

interface RailPack {
  locale: string;
  generated_at: string;
  refund_request_template: string;
  follow_up_template: string;
  escalation_checklist: string[];
  evidence_checklist: string[];
  disclaimer: string;
}

function formatCurrency(cents: number, currency: string): string {
  const amount = cents / 100;
  const formatter = new Intl.NumberFormat(currency === 'MXN' ? 'es-MX' : 'en-US', {
    style: 'currency',
    currency: currency || 'USD',
  });
  return formatter.format(amount);
}

function formatDate(dateStr: string, locale: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function getIssueLabel(issueType: string, locale: string): string {
  const labels: Record<string, { en: string; es: string }> = {
    unauthorized_charge: { en: "Unauthorized Charge", es: "Cargo no autorizado" },
    product_not_received: { en: "Product Not Received", es: "Producto no recibido" },
    product_not_as_described: { en: "Product Not as Described", es: "Producto diferente al descrito" },
    duplicate_charge: { en: "Duplicate Charge", es: "Cargo duplicado" },
    subscription_cancellation: { en: "Subscription Cancellation Issue", es: "Problema con cancelación de suscripción" },
    refund_not_processed: { en: "Refund Not Processed", es: "Reembolso no procesado" },
    scam_fraud: { en: "Scam / Fraud", es: "Estafa / Fraude" },
    other: { en: "Other Issue", es: "Otro problema" },
  };
  return labels[issueType]?.[locale === 'es' ? 'es' : 'en'] || issueType;
}

function getPaymentMethodLabel(method: string, locale: string): string {
  const labels: Record<string, { en: string; es: string }> = {
    credit_card: { en: "Credit Card", es: "Tarjeta de crédito" },
    debit_card: { en: "Debit Card", es: "Tarjeta de débito" },
    paypal: { en: "PayPal", es: "PayPal" },
    venmo: { en: "Venmo", es: "Venmo" },
    zelle: { en: "Zelle", es: "Zelle" },
    cash_app: { en: "Cash App", es: "Cash App" },
    apple_pay: { en: "Apple Pay", es: "Apple Pay" },
    google_pay: { en: "Google Pay", es: "Google Pay" },
    bank_transfer: { en: "Bank Transfer", es: "Transferencia bancaria" },
    crypto: { en: "Cryptocurrency", es: "Criptomoneda" },
    gift_card: { en: "Gift Card", es: "Tarjeta de regalo" },
    other: { en: "Other", es: "Otro" },
  };
  return labels[method]?.[locale === 'es' ? 'es' : 'en'] || method;
}

function getOutcomeLabel(outcome: string, locale: string): string {
  const labels: Record<string, { en: string; es: string }> = {
    full_refund: { en: "Full Refund", es: "Reembolso completo" },
    partial_refund: { en: "Partial Refund", es: "Reembolso parcial" },
    replacement: { en: "Product Replacement", es: "Reemplazo del producto" },
    store_credit: { en: "Store Credit", es: "Crédito en tienda" },
    chargeback: { en: "Chargeback", es: "Contracargo" },
    other: { en: "Other Resolution", es: "Otra resolución" },
  };
  return labels[outcome]?.[locale === 'es' ? 'es' : 'en'] || outcome;
}

function generateRailPack(caseData: MoneyCaseInput, caseId: string): RailPack {
  const locale = caseData.locale || 'en';
  const isSpanish = locale === 'es';
  
  const amount = caseData.amount_cents ? formatCurrency(caseData.amount_cents, caseData.currency || 'USD') : '[AMOUNT]';
  const date = caseData.transaction_date ? formatDate(caseData.transaction_date, locale) : '[DATE]';
  const merchant = caseData.merchant_name || '[MERCHANT NAME]';
  const issueLabel = getIssueLabel(caseData.issue_type, locale);
  const paymentLabel = caseData.payment_method ? getPaymentMethodLabel(caseData.payment_method, locale) : '[PAYMENT METHOD]';
  const outcomeLabel = caseData.desired_outcome ? getOutcomeLabel(caseData.desired_outcome, locale) : '[DESIRED OUTCOME]';

  const refundRequestTemplate = isSpanish
    ? `Asunto: Solicitud de reembolso - ${issueLabel} - ${amount}

Estimado equipo de atención al cliente de ${merchant},

Me comunico para solicitar un reembolso por una transacción realizada el ${date} por un monto de ${amount}.

Motivo de la solicitud: ${issueLabel}
${caseData.description ? `\nDetalles adicionales: ${caseData.description}` : ''}

Método de pago utilizado: ${paymentLabel}
Resolución solicitada: ${outcomeLabel}

Por favor, procesen mi solicitud a la brevedad. Adjunto evidencia de respaldo cuando aplique.

Agradezco su pronta respuesta.

Atentamente,
[TU NOMBRE]
[TU EMAIL]
[TU TELÉFONO]

Referencia del caso: ${caseId}`
    : `Subject: Refund Request - ${issueLabel} - ${amount}

Dear ${merchant} Customer Service,

I am writing to request a refund for a transaction dated ${date} in the amount of ${amount}.

Reason for request: ${issueLabel}
${caseData.description ? `\nAdditional details: ${caseData.description}` : ''}

Payment method used: ${paymentLabel}
Requested resolution: ${outcomeLabel}

Please process my request at your earliest convenience. I am attaching supporting evidence where applicable.

I appreciate your prompt attention to this matter.

Sincerely,
[YOUR NAME]
[YOUR EMAIL]
[YOUR PHONE]

Case Reference: ${caseId}`;

  const followUpTemplate = isSpanish
    ? `Asunto: Seguimiento - Solicitud de reembolso pendiente - Ref: ${caseId}

Estimado equipo de atención al cliente de ${merchant},

Doy seguimiento a mi solicitud de reembolso enviada anteriormente.

Detalles originales:
- Fecha de transacción: ${date}
- Monto: ${amount}
- Tipo de problema: ${issueLabel}
- Referencia: ${caseId}

Han pasado [X DÍAS] desde mi solicitud original y aún no he recibido respuesta/resolución.

Por favor, proporcionen una actualización sobre el estado de mi caso.

Atentamente,
[TU NOMBRE]
[TU EMAIL]`
    : `Subject: Follow-Up - Pending Refund Request - Ref: ${caseId}

Dear ${merchant} Customer Service,

I am following up on my refund request submitted previously.

Original details:
- Transaction date: ${date}
- Amount: ${amount}
- Issue type: ${issueLabel}
- Reference: ${caseId}

It has been [X DAYS] since my original request and I have not yet received a response/resolution.

Please provide an update on the status of my case.

Sincerely,
[YOUR NAME]
[YOUR EMAIL]`;

  const escalationChecklist = isSpanish
    ? [
        "✅ Enviar solicitud inicial por escrito (email o formulario web)",
        "⏳ Esperar 3-5 días hábiles para respuesta inicial",
        "📞 Si no hay respuesta: llamar al servicio al cliente y solicitar número de caso",
        "📧 Enviar plantilla de seguimiento si no hay resolución en 7 días",
        "🏦 Si es tarjeta de crédito/débito: contactar a tu banco para iniciar disputa",
        "📱 Para PayPal/Venmo/etc: abrir disputa en el Centro de Resoluciones de la app",
        "📋 Presentar queja en PROFECO (México) o FTC/BBB (EE.UU.)",
        "⚖️ Considerar demanda en juzgado de menor cuantía si el monto lo justifica",
      ]
    : [
        "✅ Send initial request in writing (email or web form)",
        "⏳ Wait 3-5 business days for initial response",
        "📞 If no response: call customer service and request a case number",
        "📧 Send follow-up template if no resolution within 7 days",
        "🏦 If credit/debit card: contact your bank to initiate a dispute",
        "📱 For PayPal/Venmo/etc: open dispute in the app's Resolution Center",
        "📋 File complaint with FTC, CFPB, or BBB (US) / PROFECO (Mexico)",
        "⚖️ Consider small claims court if amount justifies it",
      ];

  const evidenceChecklist = isSpanish
    ? [
        "📄 Captura de pantalla del cargo/transacción",
        "🧾 Recibo o confirmación de compra original",
        "📧 Emails o mensajes con el vendedor/comercio",
        "📸 Fotos del producto (si aplica - condición, defectos)",
        "📦 Comprobante de envío o seguimiento",
        "🚫 Captura de pantalla de política de cancelación/reembolso",
        "📱 Capturas de publicidad engañosa (si aplica)",
        "🔗 URL del sitio/producto (guárdala aunque cambie)",
      ]
    : [
        "📄 Screenshot of the charge/transaction",
        "🧾 Original purchase receipt or confirmation",
        "📧 Emails or messages with the seller/merchant",
        "📸 Photos of the product (if applicable - condition, defects)",
        "📦 Shipping proof or tracking information",
        "🚫 Screenshot of cancellation/refund policy",
        "📱 Screenshots of misleading advertising (if applicable)",
        "🔗 URL of the site/product (save it even if it changes)",
      ];

  const disclaimer = isSpanish
    ? "AVISO: Esta información es orientativa y no constituye asesoría legal. REAiL no garantiza resultados específicos. Cada caso es diferente y los tiempos de resolución varían. Para asuntos legales complejos, consulte a un profesional."
    : "DISCLAIMER: This information is for guidance only and does not constitute legal advice. REAiL does not guarantee specific outcomes. Each case is different and resolution times vary. For complex legal matters, consult a professional.";

  return {
    locale,
    generated_at: new Date().toISOString(),
    refund_request_template: refundRequestTemplate,
    follow_up_template: followUpTemplate,
    escalation_checklist: escalationChecklist,
    evidence_checklist: evidenceChecklist,
    disclaimer,
  };
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || "unknown";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const reqUrl = new URL(req.url);

  if (reqUrl.searchParams.get("health") !== null) {
    return new Response(JSON.stringify({
      ok: true,
      endpoint: ENDPOINT,
      details: {
        secrets: {
          PROJECT_URL: !!Deno.env.get("PROJECT_URL"),
          SERVICE_ROLE_KEY: !!Deno.env.get("SERVICE_ROLE_KEY"),
        },
        verbose: VERBOSE,
      },
      timestamp: new Date().toISOString(),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("PROJECT_URL")!;
  const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const deviceId = req.headers.get("x-device-id") || "anonymous";
  const ip = getClientIp(req);

  try {
    if (req.method === "GET") {
      const caseId = reqUrl.searchParams.get("case_id");
      if (!caseId) {
        return new Response(JSON.stringify({
          ok: false,
          error_code: "invalid_input",
          message: "case_id query parameter is required",
          endpoint: ENDPOINT,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: moneyCase, error } = await supabase
        .from("money_cases")
        .select("*")
        .eq("id", caseId)
        .single();

      if (error || !moneyCase) {
        return new Response(JSON.stringify({
          ok: false,
          error_code: "not_found",
          message: "Money case not found",
          endpoint: ENDPOINT,
        }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (moneyCase.device_id && moneyCase.device_id !== deviceId) {
        return new Response(JSON.stringify({
          ok: false,
          error_code: "forbidden",
          message: "You do not have access to this case",
          endpoint: ENDPOINT,
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: events } = await supabase
        .from("case_events")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });

      const { data: artifacts } = await supabase
        .from("case_artifacts")
        .select("*")
        .eq("case_id", caseId)
        .order("uploaded_at", { ascending: false });

      return new Response(JSON.stringify({
        ok: true,
        case: {
          id: moneyCase.id,
          share_token: moneyCase.share_token,
          issue_type: moneyCase.issue_type,
          status: moneyCase.status,
          amount_cents: moneyCase.amount_cents,
          currency: moneyCase.currency,
          transaction_date: moneyCase.transaction_date,
          payment_method: moneyCase.payment_method,
          merchant_name: moneyCase.merchant_name,
          merchant_url: moneyCase.merchant_url,
          description: moneyCase.description,
          desired_outcome: moneyCase.desired_outcome,
          locale: moneyCase.locale,
          created_at: moneyCase.created_at,
          updated_at: moneyCase.updated_at,
        },
        rail_pack: moneyCase.rail_pack,
        events: events || [],
        artifacts: artifacts || [],
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "POST") {
      const now = new Date();
      const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
      const { count } = await supabase
        .from("money_cases")
        .select("*", { count: "exact", head: true })
        .eq("device_id", deviceId)
        .gte("created_at", windowStart.toISOString());

      if ((count ?? 0) >= MONEY_CASE_RATE_LIMIT) {
        return new Response(JSON.stringify({
          ok: false,
          error_code: "rate_limit_exceeded",
          message: "Too many cases created. Please try again later.",
          endpoint: ENDPOINT,
          retry_after_seconds: RATE_LIMIT_WINDOW_MINUTES * 60,
          rate_limit: { remaining: 0, limit: MONEY_CASE_RATE_LIMIT, window_seconds: RATE_LIMIT_WINDOW_MINUTES * 60 },
        }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(RATE_LIMIT_WINDOW_MINUTES * 60) } });
      }

      const body: MoneyCaseInput = await req.json();

      if (!body.issue_type) {
        return new Response(JSON.stringify({
          ok: false,
          error_code: "invalid_input",
          message: "issue_type is required",
          endpoint: ENDPOINT,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const validIssueTypes = [
        'unauthorized_charge', 'product_not_received', 'product_not_as_described',
        'duplicate_charge', 'subscription_cancellation', 'refund_not_processed',
        'scam_fraud', 'other'
      ];
      if (!validIssueTypes.includes(body.issue_type)) {
        return new Response(JSON.stringify({
          ok: false,
          error_code: "invalid_input",
          message: `issue_type must be one of: ${validIssueTypes.join(', ')}`,
          endpoint: ENDPOINT,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let merchantDomain: string | null = null;
      if (body.merchant_url) {
        try {
          merchantDomain = new URL(body.merchant_url).hostname.replace(/^www\./, "");
        } catch {
          merchantDomain = null;
        }
      }

      const tempId = crypto.randomUUID();
      const railPack = generateRailPack(body, tempId);

      const insertData: Record<string, unknown> = {
        id: tempId,
        share_token: body.share_token || null,
        issue_type: body.issue_type,
        status: 'submitted',
        amount_cents: body.amount_cents || null,
        currency: body.currency || 'USD',
        transaction_date: body.transaction_date || null,
        payment_method: body.payment_method || null,
        merchant_name: body.merchant_name || null,
        merchant_url: body.merchant_url || null,
        merchant_domain: merchantDomain,
        description: body.description || null,
        desired_outcome: body.desired_outcome || null,
        rail_pack: railPack,
        device_id: deviceId,
        ip: ip,
        locale: body.locale || 'en',
      };

      const { data: newCase, error: insertError } = await supabase
        .from("money_cases")
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        console.error("[money-case] Insert error:", insertError);
        return new Response(JSON.stringify({
          ok: false,
          error_code: "db_error",
          message: "Failed to create money case",
          endpoint: ENDPOINT,
          details: VERBOSE ? insertError.message : undefined,
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.rpc("add_case_event", {
        p_case_id: newCase.id,
        p_event_type: "case_created",
        p_title: body.locale === 'es' ? "Caso creado" : "Case Created",
        p_description: body.locale === 'es' 
          ? "Se generó el Rail Pack con plantillas y checklists"
          : "Rail Pack generated with templates and checklists",
        p_metadata: { locale: body.locale || 'en' },
      });

      if (VERBOSE) console.log("[money-case] Created case:", newCase.id);

      return new Response(JSON.stringify({
        ok: true,
        case_id: newCase.id,
        status: newCase.status,
        rail_pack: railPack,
        created_at: newCase.created_at,
      }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      ok: false,
      error_code: "method_not_allowed",
      message: "Method not allowed",
      endpoint: ENDPOINT,
    }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[money-case] Error:", error);
    const errObj = error instanceof Error ? error : new Error(String(error));
    return new Response(JSON.stringify({
      ok: false,
      error_code: "internal_error",
      message: errObj.message,
      endpoint: ENDPOINT,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
