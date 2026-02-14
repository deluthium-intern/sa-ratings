const PDFDocument = require("pdfkit");

function generateSovereignReport({ agent, rating, metrics, events }) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff");
    doc.fillColor("#111111").fontSize(11);

    doc.font("Courier-Bold").fontSize(20).text("S&A RATINGS", { align: "left" });
    doc.font("Courier").fontSize(10).text("SOVEREIGN AGENT CREDIT REPORT", { align: "left" });
    doc.moveDown(0.5);
    doc.moveTo(48, doc.y).lineTo(doc.page.width - 48, doc.y).dash(3, { space: 3 }).stroke("#333333");
    doc.undash();
    doc.moveDown(1);

    doc.font("Courier-Bold").fontSize(12).text("CASE FILE");
    doc.font("Courier")
      .fontSize(10)
      .text(`Agent ID: ${agent.id}`)
      .text(`Agent Name: ${agent.name}`)
      .text(`Wallet: ${agent.wallet_address}`)
      .text(`Issued At: ${new Date(rating.created_at).toISOString()}`);

    doc.moveDown(0.8);
    doc.font("Courier-Bold").text("CURRENT RULING");
    doc.font("Courier")
      .text(`Grade: ${rating.grade}`)
      .text(`Outlook: ${rating.outlook}`)
      .text(`Fee Multiplier: ${Number(rating.fee_multiplier).toFixed(2)}x`)
      .text(`Composite Score: ${Number(rating.score).toFixed(2)}`)
      .text(`Reason: ${rating.reason}`);

    doc.moveDown(0.8);
    doc.font("Courier-Bold").text("AUDIT METRICS");
    doc.font("Courier")
      .text(`X402 Latency (ms): ${metrics.x402_latency_ms}`)
      .text(`Strategy Drift Index: ${Number(metrics.strategy_drift_index).toFixed(4)}`)
      .text(`Payment Defaulted: ${metrics.payment_defaulted ? "YES" : "NO"}`);

    doc.moveDown(0.8);
    doc.font("Courier-Bold").text("DEFAULT HISTORY");
    if (!events.length) {
      doc.font("Courier").text("No recorded credit events.");
    } else {
      events.slice(0, 10).forEach((event) => {
        doc
          .font("Courier")
          .text(
            `${new Date(event.created_at).toISOString()} | ${event.event_type} | ${
              event.from_grade || "N/A"
            } -> ${event.to_grade || "N/A"} | ${event.reason}`
          );
      });
    }

    doc.fontSize(44).fillColor("#e7e7e7").rotate(-35, { origin: [280, 500] });
    doc.text("S&A OFFICIAL RECORD", 120, 420, { opacity: 0.3 });
    doc.rotate(35, { origin: [280, 500] });
    doc.fillColor("#111111").fontSize(9);
    doc.text("The machine does not lie. Deluthium does not forget.", 48, 780, { align: "right" });

    doc.end();
  });
}

module.exports = {
  generateSovereignReport
};
