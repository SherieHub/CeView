/**
 * The Terms of Use and Privacy Notice, as structured content for LegalPage.
 *
 * Source: "CeView Terms of Use.pdf" and "CeView Privacy Notice.pdf" (Oct 8,
 * 2026), revised so every statement matches what CeView actually does —
 * checked against the code and docs/DEPLOY_AWS.md. Notable corrections:
 * TikTok ad accounts, the email-code (Resend) and phone-verification
 * (Firebase) providers, the business text Hugging Face receives, the ad click
 * IDs stored with a link click, and browser storage were all missing.
 *
 * Inline markup in any text: **bold** and [label](/path).
 *
 * This is not legal advice; have the final text reviewed before relying on it.
 */

export type LegalBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; caption: string; head: string[]; rows: string[][] }
  | { kind: 'note'; text: string };

export interface LegalSection {
  id: string;
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  slug: 'terms' | 'privacy';
  title: string;
  /** One sentence under the title. */
  lede: string;
  effective: string;
  /** Plain-language highlights, shown before the full text. */
  summary: string[];
  sections: LegalSection[];
}

export const LEGAL_CONTACT = {
  operator: 'Team A.I.Con',
  dpoName: 'Austine John P. Lomocso',
  email: 'austinelomocso@gmail.com',
} as const;

const EFFECTIVE = 'October 20, 2026';

export const PRIVACY: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy Notice',
  lede: 'What personal data CeView collects, why, who we share it with, and the rights you have under the Philippine Data Privacy Act of 2012.',
  effective: EFFECTIVE,
  summary: [
    'We collect only what CeView needs to work, and we never sell personal data.',
    'Traveller IP addresses are scrambled before storage — the real address is never kept.',
    'Your data is stored on Amazon Web Services in Singapore and protected with encryption.',
    'You can ask to see, correct, download or delete your data at any time.',
  ],
  sections: [
    {
      id: 'about',
      title: 'About this notice',
      blocks: [
        { kind: 'p', text: 'CeView is an AI-powered destination marketing tool that helps micro, small and medium enterprises (MSMEs) in Cebu plan and promote their businesses. It is operated by **Team A.I.Con** ("CeView", "we", "us"), the personal information controller for the data described here.' },
        { kind: 'p', text: 'This notice explains how we handle personal data under the Data Privacy Act of 2012 (Republic Act No. 10173). It applies to:' },
        { kind: 'list', items: [
          '**Operators** — business owners and staff who create a CeView account.',
          '**Travellers** — people who open a CeView tracking link or send an enquiry through a CeView enquiry page.',
        ] },
      ],
    },
    {
      id: 'collect',
      title: 'Personal data we collect',
      blocks: [
        { kind: 'p', text: 'We collect only what CeView needs to work. We do not ask for sensitive personal information as defined by the Data Privacy Act.' },
        { kind: 'table', caption: 'What we collect, from whom, and how', head: ['Who', 'Data', 'How we get it'], rows: [
          ['Operators', 'First and last name, email address, password (stored only as a one-way hash, never in readable form), and contact number if you give one', 'You provide it when you register'],
          ['Operators', 'One-time codes used to confirm your email address, reset your password or verify your phone number', 'Sent to you when you ask for them'],
          ['Operators using Google sign-in', 'Name, email address and the profile details Google shares', 'Google, when you choose "Continue with Google"'],
          ['Operators', 'Business profile details, including descriptions, services, slogan, website and uploaded images or logo', 'You provide them when you set up or edit your business'],
          ['Operators', 'Campaign figures you enter or sync, such as impressions, clicks, ad spend, revenue and bookings', 'You provide them, or your connected ad account'],
          ['Operators who connect a Meta or TikTok ad account', 'An access token for the ad account (stored encrypted), the account and campaign names, and ad performance metrics', 'Meta or TikTok, when you authorize the connection'],
          ['Travellers who open a CeView link', 'A scrambled (hashed) version of your IP address, your browser type (user agent), the page that referred you and, if present in the link, the ad platform\'s click ID. We never store your actual IP address.', 'Your browser, automatically'],
          ['Travellers who send an enquiry', 'Your name, email address or phone number, party size, travel dates and message', 'You provide them in the enquiry form'],
        ] },
        { kind: 'note', text: 'Business profile content can include personal data if you add it — for example an owner\'s or staff member\'s name. Only include what you are comfortable making part of your business profile.' },
      ],
    },
    {
      id: 'use',
      title: 'Why we use it',
      blocks: [
        { kind: 'p', text: 'We use personal data only for the purposes below, and we do not sell it.' },
        { kind: 'table', caption: 'Purposes and legal basis', head: ['Purpose', 'Data used', 'Legal basis under the DPA'], rows: [
          ['Create and secure your account, verify your email or phone, and let you sign in', 'Account details, verification codes, Google sign-in details', 'Necessary to provide the service you signed up for'],
          ['Classify your business, generate marketing content, forecast demand and score your campaigns', 'Business profile, descriptions, images, campaign figures, search terms', 'Necessary to provide the service'],
          ['Show your ad performance inside CeView', 'Meta or TikTok access token and ad metrics', 'Your consent, given when you connect the account'],
          ['Measure how many travellers your links bring in, without double-counting the same visitor', 'Hashed IP, browser type, referrer, ad click ID', 'Our legitimate interest in giving operators accurate results'],
          ['Pass traveller enquiries to the business', 'Enquiry details', 'Necessary to respond to the traveller\'s request'],
          ['Keep CeView secure, fix problems and recover from failures', 'Any of the above, through logs and backups', 'Our legitimate interest in running a secure, reliable service'],
        ] },
        { kind: 'p', text: 'You can withdraw your consent for an ad-account connection at any time by disconnecting it in **Settings → Platforms** or by contacting us. Withdrawing consent does not affect what was done before.' },
      ],
    },
    {
      id: 'automated',
      title: 'AI and automated processing',
      blocks: [
        { kind: 'p', text: 'CeView uses automated processing, including AI models, to classify businesses, write caption drafts, forecast demand and score campaign performance. These results are suggestions for you to review. CeView does not make decisions about you that have legal or similarly significant effects.' },
        { kind: 'p', text: 'You can ask us how a result about your business was produced, and ask for a person to review it.' },
      ],
    },
    {
      id: 'share',
      title: 'Who we share it with',
      blocks: [
        { kind: 'p', text: 'We use the service providers below to run CeView. They process data on our behalf, only for the purposes in this notice. Some are outside the Philippines, so your data may be transferred abroad; we use providers that commit to protecting it under their own security and privacy terms.' },
        { kind: 'table', caption: 'Service providers', head: ['Provider', 'What they receive', 'Why', 'Location'], rows: [
          ['Amazon Web Services (AWS)', 'All data CeView stores, including backups and logs', 'Hosting the database, servers and website', 'Singapore'],
          ['Groq', 'Business descriptions, images, generated captions and campaign figures', 'AI content generation, image analysis and performance reports', 'United States'],
          ['Hugging Face', 'Business descriptions, value proposition and services; market data for forecasts', 'Business classification and demand forecasting', 'United States'],
          ['SerpApi', 'Search terms (no personal data)', 'Market and trend research', 'United States'],
          ['Google (Firebase)', 'Google sign-in details and the phone number you verify', '"Continue with Google" sign-in and phone verification codes', 'United States'],
          ['Resend', 'Your email address and a one-time code', 'Sending email verification and password-reset codes', 'United States'],
          ['Meta and TikTok', 'Your ad-account connection', 'Reading ad performance metrics, only if you connect an account', 'United States'],
        ] },
        { kind: 'p', text: 'When a traveller sends an enquiry, it goes to the business it is addressed to, which handles its follow-up under its own practices. We may also disclose personal data when required by law, a court order or a lawful request from a government authority.' },
      ],
    },
    {
      id: 'storage',
      title: 'Where it is stored and how we protect it',
      blocks: [
        { kind: 'p', text: 'Your data is stored on Amazon Web Services servers in Singapore, including our database, backups, logs and system secrets. We protect it with organizational, physical and technical measures, including:' },
        { kind: 'list', items: [
          '**Encryption in transit** — all connections to CeView use HTTPS.',
          '**Encryption at rest** — the database disk, backups and system secrets are encrypted.',
          '**Password protection** — passwords are stored only as one-way hashes.',
          '**Token protection** — connected ad-account tokens are stored encrypted.',
          '**Data minimization** — traveller IP addresses are hashed with a secret value before storage; the original IP is never kept.',
          '**Access control** — only authorized team members can reach our systems, using multi-factor authentication, and the database is not reachable from the internet.',
          '**Audit and recovery** — access to our cloud systems is logged, and we keep encrypted backups and test restoring them.',
        ] },
        { kind: 'p', text: 'No system is perfectly secure. If a personal data breach is likely to put you at risk, we will notify you and the National Privacy Commission as the law requires, within 72 hours of discovering it.' },
      ],
    },
    {
      id: 'browser',
      title: 'Cookies and browser storage',
      blocks: [
        { kind: 'p', text: 'CeView does not use advertising or third-party analytics cookies. The app keeps a few items in your own browser\'s local storage so it works smoothly — your sign-in session, small preferences such as dismissed tips, and a cover photo you upload to your dashboard. They stay on your device, and signing out or clearing your browser data removes them.' },
      ],
    },
    {
      id: 'retention',
      title: 'How long we keep it',
      blocks: [
        { kind: 'p', text: 'We keep personal data only as long as we need it for the purposes above.' },
        { kind: 'table', caption: 'Retention periods', head: ['Data', 'Kept for'], rows: [
          ['Account and business profile data', 'While your account is active, then deleted within **30 days** after you close your account or ask us to delete it'],
          ['Connected ad-account token', 'Until you disconnect the account or close your CeView account'],
          ['Traveller click and enquiry data', '12 months, or until the business\'s account is closed, whichever comes first'],
          ['Database backups', '30 days, then automatically deleted'],
          ['System logs', '14 days, then automatically deleted'],
        ] },
        { kind: 'note', text: 'Data removed from the live system may remain in backups until those backups expire.' },
      ],
    },
    {
      id: 'rights',
      title: 'Your rights',
      blocks: [
        { kind: 'p', text: 'Under the Data Privacy Act, you have the right to:' },
        { kind: 'list', items: [
          '**Be informed** about how your personal data is collected and used — which is what this notice does.',
          '**Access** the personal data we hold about you.',
          '**Correct** data that is inaccurate or incomplete.',
          '**Object** to processing, including withdrawing consent you gave.',
          '**Erase or block** your data when it is no longer needed, was unlawfully obtained, or you withdraw consent.',
          '**Data portability** — get a copy of your data in a commonly used electronic format.',
          '**Be indemnified** for damages caused by inaccurate, false or unlawfully obtained data, or by unauthorized use.',
          '**File a complaint** with the National Privacy Commission.',
        ] },
        { kind: 'p', text: 'To use any of these rights, contact us using the details below. We may ask you to confirm your identity first, and we will respond within a reasonable time.' },
      ],
    },
    {
      id: 'children',
      title: 'Children',
      blocks: [
        { kind: 'p', text: 'CeView accounts are for people aged 18 and over. We do not knowingly collect personal data from children. If you believe a child has given us personal data, contact us and we will delete it.' },
      ],
    },
    {
      id: 'contact',
      title: 'Contact us',
      blocks: [
        { kind: 'p', text: `For privacy questions, requests or complaints, contact our Data Protection Officer, **${LEGAL_CONTACT.dpoName}**, at **${LEGAL_CONTACT.email}**.` },
        { kind: 'p', text: 'If you are not satisfied with our response, you can file a complaint with the National Privacy Commission at [privacy.gov.ph](https://privacy.gov.ph).' },
      ],
    },
    {
      id: 'changes',
      title: 'Changes to this notice',
      blocks: [
        { kind: 'p', text: 'We may update this notice when CeView or the law changes. We will post the new version on this page with a new effective date, and tell operators about significant changes by email or inside CeView.' },
      ],
    },
  ],
};

export const TERMS: LegalDoc = {
  slug: 'terms',
  title: 'Terms of Use',
  lede: 'The agreement between you and CeView when you create an account or use the service.',
  effective: EFFECTIVE,
  summary: [
    'CeView is a free pilot — features can change and the service may sometimes be unavailable.',
    'You own the content you upload; we use it only to run CeView for you.',
    'AI output and forecasts are suggestions — review them before you publish or act on them.',
    'You must be 18 or older, and you are responsible for activity on your account.',
  ],
  sections: [
    {
      id: 'agreement',
      title: 'Agreement',
      blocks: [
        { kind: 'p', text: 'By creating a CeView account or using CeView, you agree to these Terms of Use. If you do not agree, please do not use CeView.' },
        { kind: 'p', text: 'CeView is an AI-powered destination marketing tool for micro, small and medium enterprises (MSMEs) in Cebu. It is operated by **Team A.I.Con** ("CeView", "we", "us").' },
        { kind: 'p', text: 'Our [Privacy Notice](/privacy) explains how we handle personal data and forms part of these terms.' },
      ],
    },
    {
      id: 'pilot',
      title: 'A free pilot service',
      blocks: [
        { kind: 'p', text: 'CeView is currently offered free of charge as a **pilot**. While we learn from the pilot, features may change, be added or be removed, and the service may occasionally be unavailable. If we ever introduce paid plans, we will tell you in advance and you will not be charged without agreeing to it.' },
      ],
    },
    {
      id: 'eligibility',
      title: 'Who can use CeView',
      blocks: [
        { kind: 'p', text: 'You must be at least 18 years old and able to enter into a binding agreement. If you use CeView on behalf of a business, you confirm that you are authorized to accept these terms for that business.' },
      ],
    },
    {
      id: 'account',
      title: 'Your account',
      blocks: [
        { kind: 'list', items: [
          'Give accurate information when you register, and keep it up to date.',
          'Keep your password private. You are responsible for activity on your account.',
          `Tell us right away at **${LEGAL_CONTACT.email}** if you think someone has accessed your account without permission.`,
          'One account is for one person. If staff need access, each should have their own account where CeView supports it.',
          'Anyone you add to your workspace can see and work on your business profile and its connected platforms, so add only people you trust.',
        ] },
        { kind: 'p', text: 'We may suspend or close accounts that break these terms or put other users or CeView at risk.' },
      ],
    },
    {
      id: 'content',
      title: 'Your content',
      blocks: [
        { kind: 'p', text: 'You keep ownership of the business descriptions, images and other content you upload ("your content").' },
        { kind: 'p', text: 'You give CeView permission to store, process and display your content, and to send it to the service providers listed in our Privacy Notice, only as needed to run CeView for you. This permission ends when you delete the content or close your account, except for copies in backups until they expire.' },
        { kind: 'p', text: 'You confirm that you have the right to upload your content and that it does not infringe anyone else\'s copyright, trademark, privacy or other rights. Only upload images of people who have agreed to it.' },
      ],
    },
    {
      id: 'use',
      title: 'Acceptable use',
      blocks: [
        { kind: 'p', text: 'You agree not to:' },
        { kind: 'list', items: [
          'Use CeView for anything illegal, deceptive or harmful, including false or misleading advertising.',
          'Upload content that is unlawful, defamatory, obscene, hateful or that violates someone\'s privacy.',
          'Try to access other users\' accounts or data, or parts of CeView you are not meant to reach.',
          'Disrupt, overload or probe the security of CeView, or use bots or scripts to access it without our permission.',
          'Copy, resell or reverse-engineer CeView.',
        ] },
        { kind: 'p', text: 'CeView helps you prepare content; you decide what to publish and where. You are responsible for content and advertising you publish outside CeView, including following the rules of platforms such as Meta and TikTok.' },
      ],
    },
    {
      id: 'ai',
      title: 'AI-generated content and forecasts',
      blocks: [
        { kind: 'p', text: 'CeView uses artificial intelligence to generate captions and marketing content, analyze images, classify and score your business, and forecast demand.' },
        { kind: 'list', items: [
          '**Review before you publish.** AI output can be inaccurate, incomplete or unsuitable. You are responsible for checking anything you publish or act on.',
          '**Forecasts are estimates.** Demand forecasts, market trends and scores come from models and outside data. They are not guarantees of future visitors, sales or results.',
          '**Not professional advice.** CeView does not provide business, financial or legal advice.',
        ] },
        { kind: 'p', text: 'You may use the content CeView generates for you to promote your business.' },
      ],
    },
    {
      id: 'third-party',
      title: 'Third-party services',
      blocks: [
        { kind: 'p', text: 'Some features depend on other companies\' services, including Google sign-in, Meta and TikTok ad accounts, and AI and search providers. When you connect or use them, their own terms and privacy policies also apply. We are not responsible for their services, and features that rely on them may stop working if they change or become unavailable.' },
      ],
    },
    {
      id: 'availability',
      title: 'Availability and disclaimers',
      blocks: [
        { kind: 'p', text: 'We work to keep CeView running and your data safe, but as a pilot service CeView is provided **"as is"** and **"as available"**. We do not promise that it will be uninterrupted or error-free, or that every feature will stay available. We usually carry out maintenance outside Cebu business hours.' },
        { kind: 'p', text: 'To the extent the law allows, we disclaim all warranties not stated in these terms.' },
      ],
    },
    {
      id: 'liability',
      title: 'Limitation of liability',
      blocks: [
        { kind: 'p', text: 'To the extent the law allows, CeView and its team are not liable for indirect or consequential losses — such as lost profits, lost bookings or lost business opportunities — arising from your use of CeView, AI-generated content, forecasts or third-party services.' },
        { kind: 'p', text: 'Because CeView is provided free of charge, our total liability to you for any claim related to CeView is limited to **PHP 5,000**.' },
        { kind: 'p', text: 'Nothing in these terms limits liability that cannot be limited under Philippine law, including your rights under the Data Privacy Act.' },
      ],
    },
    {
      id: 'ending',
      title: 'Ending your use',
      blocks: [
        { kind: 'p', text: 'You can stop using CeView at any time and ask us to close your account by contacting us. We handle your data afterwards as described in the [Privacy Notice](/privacy).' },
        { kind: 'p', text: 'We may suspend or end your access if you break these terms, if required by law, or if we end the pilot. Where reasonable, we will give you notice first and, on request, a copy of your data.' },
      ],
    },
    {
      id: 'changes',
      title: 'Changes to these terms',
      blocks: [
        { kind: 'p', text: 'We may update these terms as CeView changes. We will post the new version on this page with a new effective date, and tell operators about significant changes by email or inside CeView. Continuing to use CeView after a change takes effect means you accept the updated terms.' },
      ],
    },
    {
      id: 'law',
      title: 'Governing law',
      blocks: [
        { kind: 'p', text: 'These terms are governed by the laws of the Republic of the Philippines. Disputes will be brought before the proper courts of **Cebu City**.' },
        { kind: 'p', text: 'If any part of these terms is found unenforceable, the rest stays in effect.' },
      ],
    },
    {
      id: 'contact',
      title: 'Contact us',
      blocks: [
        { kind: 'p', text: `Questions about these terms: **${LEGAL_CONTACT.email}**.` },
      ],
    },
  ],
};
