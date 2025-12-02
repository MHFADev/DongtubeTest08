import nodemailer from 'nodemailer';
import { NotificationConfig } from '../models/index.js';

class NotificationService {
  constructor() {
    this.transporter = null;
    this.configCache = new Map();
    this.cacheTime = 0;
    this.CACHE_DURATION = 60000;
  }

  async initializeEmailTransporter() {
    if (this.transporter) return this.transporter;

    const emailUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const emailPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
    const emailHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const emailPort = process.env.SMTP_PORT || 587;

    if (!emailUser || !emailPass) {
      console.warn('⚠️  Email credentials not configured. Email notifications disabled.');
      return null;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort,
        secure: emailPort == 465,
        auth: {
          user: emailUser,
          pass: emailPass
        }
      });

      await this.transporter.verify();
      console.log('✓ Email transporter initialized');
      return this.transporter;
    } catch (error) {
      console.error('✗ Email transporter error:', error.message);
      return null;
    }
  }

  async loadConfigs() {
    const now = Date.now();
    if (this.configCache.size > 0 && (now - this.cacheTime) < this.CACHE_DURATION) {
      return this.configCache;
    }

    const configs = await NotificationConfig.findAll({
      where: { enabled: true }
    });

    this.configCache.clear();
    configs.forEach(config => {
      this.configCache.set(config.eventType, config);
    });
    this.cacheTime = now;

    return this.configCache;
  }

  async sendEmail(to, subject, html) {
    try {
      const transporter = await this.initializeEmailTransporter();
      if (!transporter) return false;

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.EMAIL_USER,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html
      });

      console.log('✓ Email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('✗ Email send error:', error.message);
      return false;
    }
  }

  async sendWhatsApp(phoneNumbers, message) {
    console.log('📱 WhatsApp notification:', message, 'to', phoneNumbers);
    return true;
  }

  async notify(eventType, data) {
    try {
      const configs = await this.loadConfigs();
      const config = configs.get(eventType);

      if (!config) {
        return;
      }

      if (config.emailEnabled && config.emailRecipients?.length > 0) {
        const subject = this.getEmailSubject(eventType, data);
        const html = this.getEmailBody(eventType, data);
        await this.sendEmail(config.emailRecipients, subject, html);
      }

      if (config.whatsappEnabled && config.whatsappRecipients?.length > 0) {
        const message = this.getWhatsAppMessage(eventType, data);
        await this.sendWhatsApp(config.whatsappRecipients, message);
      }
    } catch (error) {
      console.error('Notification error:', error);
    }
  }

  getEmailSubject(eventType, data) {
    const subjects = {
      'vip_granted': `✨ New VIP User: ${data.email}`,
      'error_alert': `⚠️ System Error Alert`,
      'user_signup': `👤 New User Registered: ${data.email}`,
      'high_traffic': `📈 High Traffic Alert`,
      'endpoint_created': `🔗 New Endpoint Created`,
      'role_changed': `🔄 User Role Changed: ${data.email}`
    };
    return subjects[eventType] || `Notification: ${eventType}`;
  }

  getEmailBody(eventType, data) {
    const templates = {
      'vip_granted': `
        <h2>New VIP User</h2>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Expires:</strong> ${data.expiresAt || 'Never'}</p>
        <p><strong>Granted by:</strong> Admin</p>
      `,
      'error_alert': `
        <h2>System Error Detected</h2>
        <p><strong>Error:</strong> ${data.error}</p>
        <p><strong>Path:</strong> ${data.path}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      `,
      'user_signup': `
        <h2>New User Registration</h2>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      `
    };
    return templates[eventType] || `<p>${JSON.stringify(data)}</p>`;
  }

  getWhatsAppMessage(eventType, data) {
    const messages = {
      'vip_granted': `✨ New VIP: ${data.email}`,
      'error_alert': `⚠️ Error: ${data.error}`,
      'user_signup': `👤 New User: ${data.email}`
    };
    return messages[eventType] || JSON.stringify(data);
  }

  refreshCache() {
    this.configCache.clear();
    this.cacheTime = 0;
  }
}

export default new NotificationService();
