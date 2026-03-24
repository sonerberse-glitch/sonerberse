module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to_email, to_name, scale_name, scale_ref, article_url, institution, purpose } = req.body;

  if (!to_email || !to_name || !scale_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const purposeLabels = {
    thesis: 'Lisansüstü Tez / Graduate Thesis',
    research: 'Bilimsel Araştırma / Scientific Research',
    project: 'Proje / Project',
    education: 'Eğitim Amaçlı / Educational Use',
    other: 'Diğer / Other',
  };
  const purposeLabel = purposeLabels[purpose] || purpose || '—';

  const articleLink = article_url
    ? `<div style="margin-top:12px;">
        <a href="${article_url}" style="display:inline-block;background:#0a0f1e;color:#c9a96e;text-decoration:none;font-size:12px;font-weight:600;padding:7px 16px;border-radius:6px;letter-spacing:0.5px;">
          Makaleye Ulaş · Access Article ↗
        </a>
       </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- HEADER -->
  <tr>
    <td style="background:#0a0f1e;padding:32px 40px;text-align:center;">
      <div style="display:inline-block;background:#c9a96e;border-radius:10px;width:48px;height:48px;line-height:48px;text-align:center;font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#0a0f1e;letter-spacing:1px;">SB</div>
      <div style="margin-top:12px;">
        <div style="color:#c9a96e;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Doç. Dr. Soner Berşe</div>
        <div style="color:#8892a4;font-size:11px;letter-spacing:1px;margin-top:2px;">Akademisyen · Araştırmacı · sonerberse.com</div>
      </div>
    </td>
  </tr>

  <!-- ONAY BAŞLIĞI -->
  <tr>
    <td style="background:#f0f7f0;padding:20px 40px;border-bottom:1px solid #e8f4e8;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;">
          <div style="width:32px;height:32px;background:#22c55e;border-radius:50%;text-align:center;line-height:32px;font-size:18px;color:#fff;">✓</div>
        </td>
        <td style="padding-left:12px;vertical-align:middle;">
          <div style="color:#166534;font-size:15px;font-weight:700;">İzin Onaylandı · Permission Granted</div>
          <div style="color:#15803d;font-size:12px;margin-top:2px;">Ölçek kullanım izniniz verilmiştir · Your scale usage permission has been approved</div>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- İÇERİK -->
  <tr>
    <td style="padding:36px 40px;">

      <p style="margin:0 0 20px;color:#1e293b;font-size:15px;line-height:1.6;">
        Sayın <strong>${to_name}</strong>,
      </p>
      <p style="margin:0 0 28px;color:#334155;font-size:14px;line-height:1.8;">
        <strong>${scale_name}</strong> ölçeğini kullanımınız için başvurunuz değerlendirilmiş ve <strong>kullanım izniniz onaylanmıştır.</strong>
        <br><span style="color:#64748b;font-size:13px;font-style:italic;">Your request to use <strong>${scale_name}</strong> has been reviewed and your permission has been granted.</span>
      </p>

      <!-- Referans Kutusu -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="background:#f8fafc;border-left:4px solid #c9a96e;border-radius:0 8px 8px 0;padding:20px;">
            <div style="font-size:11px;color:#c9a96e;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">📖 Kaynak Gösterme Zorunludur · Citation Required</div>
            <p style="margin:0;color:#1e293b;font-size:13px;line-height:1.8;font-style:italic;">${scale_ref}</p>
            ${articleLink}
          </td>
        </tr>
      </table>

      <!-- Uyarı -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 18px;">
            <div style="color:#92400e;font-size:13px;line-height:1.7;">
              ⚠️ <strong>Önemli · Important:</strong> Bu ölçeği kullandığınız her türlü akademik yayın, tez veya araştırmada yukarıdaki referansı <strong>kaynak olarak göstermeniz zorunludur.</strong>
              <br><span style="color:#a16207;font-size:12px;font-style:italic;">Citing the original reference is mandatory in all academic publications, theses, and research using this scale.</span>
            </div>
          </td>
        </tr>
      </table>

      <!-- Başvuru Bilgileri -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;background:#f8fafc;">
            <div style="font-size:11px;color:#94a3b8;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Başvuran · Applicant</div>
            <div style="font-size:13px;color:#1e293b;font-weight:500;margin-top:2px;">${to_name}</div>
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;background:#f8fafc;border-left:1px solid #e2e8f0;">
            <div style="font-size:11px;color:#94a3b8;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Kurum · Institution</div>
            <div style="font-size:13px;color:#1e293b;font-weight:500;margin-top:2px;">${institution || '—'}</div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding:12px 16px;background:#ffffff;">
            <div style="font-size:11px;color:#94a3b8;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Kullanım Amacı · Purpose</div>
            <div style="font-size:13px;color:#1e293b;font-weight:500;margin-top:2px;">${purposeLabel}</div>
          </td>
        </tr>
      </table>

      <p style="margin:0;color:#334155;font-size:14px;line-height:1.8;">
        Araştırmanızda başarılar dilerim. Herhangi bir sorunuz olursa iletişime geçmekten çekinmeyiniz.
        <br><span style="color:#64748b;font-size:13px;font-style:italic;">Best wishes for your research. Please don't hesitate to reach out with any questions.</span>
      </p>

    </td>
  </tr>

  <!-- İMZA -->
  <tr>
    <td style="background:#0a0f1e;padding:28px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;">
          <div style="color:#c9a96e;font-size:14px;font-weight:700;">Doç. Dr. Soner Berşe</div>
          <div style="color:#8892a4;font-size:12px;line-height:1.7;margin-top:4px;">
            Sağlık Bilimleri Fakültesi, Hemşirelik Bölümü<br>
            Gaziantep Üniversitesi<br>
            <a href="https://sonerberse.com" style="color:#c9a96e;text-decoration:none;">sonerberse.com</a>
          </div>
        </td>
        <td align="right" style="vertical-align:middle;">
          <div style="background:#c9a96e;border-radius:8px;width:40px;height:40px;line-height:40px;text-align:center;font-family:Georgia,serif;font-size:17px;font-weight:bold;color:#0a0f1e;">SB</div>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#f8fafc;padding:16px 40px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;">
        Bu e-posta <a href="https://sonerberse.com/#scales" style="color:#c9a96e;text-decoration:none;">sonerberse.com</a> üzerinden gönderilmiş otomatik bir ölçek izin bildirimidir.<br>
        <span style="font-style:italic;">Automated scale permission notification from sonerberse.com</span>
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Doç. Dr. Soner Berşe <noreply@sonerberse.com>',
        to: [to_email],
        reply_to: 'sonerberse@gmail.com',
        subject: `Ölçek Kullanım İzni Onaylandı — ${scale_name}`,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend error:', data);
      return res.status(500).json({ error: data.message || 'Email sending failed' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Email error:', err);
    return res.status(500).json({ error: err.message });
  }
};
