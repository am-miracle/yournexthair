import { AbstractNotificationProviderService } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/medusa';
import type {
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from '@medusajs/types';
import { Resend, type CreateEmailResponse } from 'resend';
import emails, {
  subjects,
  type EmailTemplateKey,
  type EmailTemplatePropsMap,
} from './emails';
import type { EmailLayoutProps } from './emails/components/EmailLayout';

type InjectedDependencies = {
  logger: Logger;
};

type FooterLink = NonNullable<EmailLayoutProps['footerLinks']>[number];

type ResendModuleOptions = {
  api_key: string;
  from: string;
  siteTitle?: string;
  companyName?: string;
  footerLinks?: FooterLink[];
};

const isFooterLink = (value: unknown): value is FooterLink => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'url' in value &&
    typeof value.url === 'string' &&
    'label' in value &&
    typeof value.label === 'string'
  );
};

const isResendModuleOptions = (value: unknown): value is ResendModuleOptions => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('api_key' in value) ||
    typeof value.api_key !== 'string' ||
    !('from' in value) ||
    typeof value.from !== 'string'
  ) {
    return false;
  }

  if ('siteTitle' in value && typeof value.siteTitle !== 'string') {
    return false;
  }

  if ('companyName' in value && typeof value.companyName !== 'string') {
    return false;
  }

  if (
    'footerLinks' in value &&
    value.footerLinks !== undefined &&
    (!Array.isArray(value.footerLinks) || !value.footerLinks.every(isFooterLink))
  ) {
    return false;
  }

  return true;
};

const isEmailTemplateKey = (value: string): value is EmailTemplateKey => value in emails;

const renderTemplate = (
  template: EmailTemplateKey,
  layoutOptions: EmailLayoutProps | undefined,
  data: ProviderSendNotificationDTO['data'],
) => {
  switch (template) {
    case 'auth-password-reset': {
      const Template = emails['auth-password-reset'];
      return (
        <Template
          {...layoutOptions}
          {...(data as EmailTemplatePropsMap['auth-password-reset'])}
        />
      );
    }
    case 'order-placed': {
      const Template = emails['order-placed'];
      return <Template {...layoutOptions} {...(data as EmailTemplatePropsMap['order-placed'])} />;
    }
    case 'customer-welcome': {
      const Template = emails['customer-welcome'];
      return (
        <Template {...layoutOptions} {...(data as EmailTemplatePropsMap['customer-welcome'])} />
      );
    }
    case 'auth-forgot-password': {
      const Template = emails['auth-forgot-password'];
      return (
        <Template
          {...layoutOptions}
          {...(data as EmailTemplatePropsMap['auth-forgot-password'])}
        />
      );
    }
  }
};

export default class ResendNotificationProviderService extends AbstractNotificationProviderService {
  public static identifier = 'resend';
  private resendClient: Resend;
  private from: string;
  private layoutOptions?: EmailLayoutProps;
  private logger: Logger;

  constructor({ logger }: InjectedDependencies, options: unknown) {
    super();
    this.logger = logger;

    if (!isResendModuleOptions(options)) {
      throw new Error(
        `Invalid options provided to Resend module. Expected { api_key: string, from: string }`,
      );
    }

    const layoutOptions: EmailLayoutProps = {};

    if ('siteTitle' in options && typeof options.siteTitle === 'string') {
      layoutOptions.siteTitle = options.siteTitle;
    }

    if ('companyName' in options && typeof options.companyName === 'string') {
      layoutOptions.companyName = options.companyName;
    }

    if ('footerLinks' in options) {
      if (options.footerLinks) {
        layoutOptions.footerLinks = options.footerLinks;
      }
    }

    this.resendClient = new Resend(options.api_key);
    this.from = options.from;
    this.layoutOptions = layoutOptions;
  }

  async send(
    notification: ProviderSendNotificationDTO,
  ): Promise<ProviderSendNotificationResultsDTO> {
    const { template } = notification;

    if (!isEmailTemplateKey(template)) {
      this.logger.error(
        `Couldn't find an email template for ${String(template)}. The valid options are ${Object.keys(
          emails,
        ).join(', ')}`,
      );
      return {};
    }

    const subject = subjects[template];

    if (!subject) {
      this.logger.warn(
        `No subject found for template ${template}. Please add a subject to the emails file.`,
      );
    }

    const response: CreateEmailResponse = await this.resendClient.emails.send({
      from: this.from,
      to: [notification.to],
      subject,
      react: renderTemplate(template, this.layoutOptions, notification.data),
    });

    if (response.error) {
      this.logger.error(`Failed to send email`, response.error);
      return {};
    }

    return { id: response.data.id };
  }
}
