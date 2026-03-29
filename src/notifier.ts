import { Resend } from "resend";
import type { PriceDrop } from "./types";

function buildEmailHtml(drops: PriceDrop[]): string {
  const rows = drops
    .map(
      (d) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          <a href="${d.url}" style="color: #143c8a; text-decoration: none; font-weight: bold;">${d.name}</a>
          <div style="font-size: 11px; color: #999; text-transform: uppercase; margin-top: 2px;">${d.shop}</div>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; color: #e53e3e; font-weight: bold;">
          ${d.current_price.toFixed(2)} €
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; text-decoration: line-through; color: #999;">
          ${d.previous_price.toFixed(2)} €
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center; color: #e53e3e; font-weight: bold;">
          -${d.drop_pct}%
        </td>
      </tr>`
    )
    .join("");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #143c8a; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 22px;">Price Drop Alert</h1>
      </div>
      <div style="padding: 20px;">
        <p style="color: #333; font-size: 15px;">Price drops detected on ${drops.length} item${drops.length > 1 ? "s" : ""} you're tracking:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <thead>
            <tr style="background: #f7f7f7;">
              <th style="padding: 10px 12px; text-align: left; font-size: 13px; color: #666;">Product</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 13px; color: #666;">Now</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 13px; color: #666;">Was</th>
              <th style="padding: 10px 12px; text-align: center; font-size: 13px; color: #666;">Drop</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">Sent by furniture-price-tracker</p>
      </div>
    </div>`;
}

export async function sendEmail(drops: PriceDrop[]): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set, skipping email notification");
    return false;
  }

  const resend = new Resend(apiKey);

  const html = buildEmailHtml(drops);
  const itemSummary = drops.map((d) => d.name).join(", ");

  try {
    const { data, error } = await resend.emails.send({
      from: "tracker@resend.dev",
      to: "amayol@freepik.com",
      subject: `Price Drop: ${itemSummary}`,
      html,
    });

    if (error) {
      console.error(`Resend error: ${JSON.stringify(error)}`);
      return false;
    }

    console.log(`Email sent successfully (id: ${data?.id})`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to send email: ${message}`);
    return false;
  }
}
