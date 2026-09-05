export type TenantFaqStep = {
  title: string;
  detail: string;
};

export type TenantFaqItem = {
  id: string;
  question: string;
  answer: string;
  steps?: TenantFaqStep[];
  /** Path under /public, e.g. /help/tenant-faq-01-login.png */
  imageSrc?: string;
  imageAlt?: string;
  imageCaption?: string;
  /** Inline visual mockup when a real screenshot needs login */
  mockup?:
    | "home"
    | "pay"
    | "receipts"
    | "electricity"
    | "maintenance"
    | "vacate"
    | "cameras";
  tips?: string[];
};

export type TenantFaqSection = {
  id: string;
  title: string;
  description: string;
  items: TenantFaqItem[];
};

export const TENANT_HELP_URL = "/help";

export const tenantFaqSections: TenantFaqSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "Sign in and find your way around the tenant portal.",
    items: [
      {
        id: "login",
        question: "How do I sign in?",
        answer:
          "Use the mobile number registered on your tenancy (or the email the owner gave you) and your password. Always choose Tenant — not Admin.",
        steps: [
          {
            title: "Open the login page",
            detail: "Go to dendukuri-residences.vercel.app/login",
          },
          {
            title: "Select Tenant",
            detail: "Tap the Tenant tab at the top of the form.",
          },
          {
            title: "Enter mobile or email + password",
            detail: "Example: 9492840830 and the password from the owner.",
          },
          {
            title: "Tap Sign in as Tenant",
            detail: "You land on your Home page with flat and dues summary.",
          },
        ],
        imageSrc: "/help/tenant-faq-01-login.png",
        imageAlt: "Tenant login screen with Tenant tab selected",
        imageCaption: "Choose Tenant, then sign in with mobile or email.",
        tips: [
          "Password forgotten? Contact the owner to reset it from Admin → Tenants.",
          "If you see “not linked to a tenancy”, the owner must connect your login to your flat.",
        ],
      },
      {
        id: "navigation",
        question: "What can I do from the menu?",
        answer:
          "After login, use the top menu: Home, Pay dues, Receipts, Cameras, Electricity, Maintenance, Agreement, Move / transfer, and Help.",
        mockup: "home",
        steps: [
          { title: "Home", detail: "See this month’s outstanding dues at a glance." },
          { title: "Pay rent", detail: "UPI payment + submit UTR for confirmation." },
          { title: "Receipts", detail: "Download PDF receipts after owner approval." },
          { title: "Cameras", detail: "Live view of gate, parking, and other common areas." },
          { title: "Electricity", detail: "View recent electricity bills for your flat." },
          { title: "Maintenance", detail: "Report repairs (tap leak, AC, etc.)." },
          { title: "Move / transfer", detail: "Request move-out or flat transfer." },
          { title: "Help", detail: "FAQ, plus request a name fix if receipts look wrong." },
        ],
      },
      {
        id: "cameras",
        question: "Can I watch the CCTV cameras?",
        answer:
          "Yes. After you sign in as Tenant, open Cameras in the menu. You will see live views of shared spaces such as the gate, parking, and lobby. The public website does not show a live feed.",
        mockup: "cameras",
        steps: [
          {
            title: "Sign in as Tenant",
            detail: "Use your registered mobile or email. Do not use the Admin tab.",
          },
          {
            title: "Open Cameras",
            detail: "Menu → Cameras, or tap Cameras on Home.",
          },
          {
            title: "View live",
            detail: "Tap View live on a camera. Some cameras open in a new tab if they use a Hik-Connect share link.",
          },
        ],
        tips: [
          "Only common-area cameras are shared. Flat interiors are never shown.",
          "If the list is empty, ask the owner to add cameras under Admin → Cameras.",
        ],
      },
    ],
  },
  {
    id: "pay-rent",
    title: "Pay rent & monthly dues",
    description: "Rent, parking, maintenance, washer, and electricity in one payment.",
    items: [
      {
        id: "what-is-due",
        question: "What is included in my monthly dues?",
        answer:
          "The Pay rent page shows a breakdown before you pay: rent, maintenance, car parking, washing machine, other charges, and electricity (when billed for that month).",
        mockup: "pay",
        tips: [
          "Move-in month usually has no dues — billing starts the month after you moved in.",
          "If you vacate mid-month, you may still owe that month’s rent and electricity.",
        ],
      },
      {
        id: "pay-steps",
        question: "How do I pay step by step?",
        answer:
          "Pay in your UPI app first, then submit the UTR reference in the portal. The owner approves it and a receipt is generated.",
        mockup: "pay",
        steps: [
          {
            title: "Open Pay rent",
            detail: "Menu → Pay rent. Check billing month (e.g. August 2026).",
          },
          {
            title: "Review the breakdown",
            detail: "Confirm rent + charges + electricity and the total outstanding.",
          },
          {
            title: "Pay via UPI",
            detail: "Scan the QR or tap Open UPI app. Pay the full outstanding amount.",
          },
          {
            title: "Copy the UTR",
            detail: "From PhonePe / GPay / Paytm — usually 12 digits in payment details.",
          },
          {
            title: "Submit UTR",
            detail: "Enter amount, payment date, UTR, optional screenshot → Submit.",
          },
          {
            title: "Wait for approval",
            detail: "Status shows pending until owner confirms. Receipt appears under Receipts.",
          },
        ],
        tips: [
          "Include your flat number in the UPI remark if the app asks.",
          "Screenshot optional but helps if the UTR is hard to read.",
          "Keep images under 5 MB.",
        ],
      },
      {
        id: "payment-pending",
        question: "I paid but status still shows Pending — why?",
        answer:
          "Submitting UTR does not auto-confirm payment. The owner reviews and approves (usually same day). Check Pay rent → Your submissions, or Receipts after approval.",
        tips: [
          "Wrong billing month selected? Submit again with the correct month.",
          "Urgent? WhatsApp the owner: flat number, month, amount, UTR.",
        ],
      },
    ],
  },
  {
    id: "pay-without-login",
    title: "Pay without login",
    description: "Quick UPI pay when you do not have portal access yet.",
    items: [
      {
        id: "public-pay",
        question: "Can I pay without a tenant login?",
        answer:
          "Yes. Use Pay without login from the sign-in page, or open /pay directly. You need your flat number and registered mobile. Amount is entered by you — dues breakdown is not shown without login.",
        imageSrc: "/help/tenant-faq-02-public-pay.png",
        imageAlt: "Pay without login — enter flat number",
        imageCaption: "Enter flat number (e.g. C201) to load UPI details.",
        steps: [
          { title: "Open /pay", detail: "Or tap Pay without login on the login page." },
          { title: "Enter flat number", detail: "e.g. C201, C102, D301" },
          { title: "Enter registered mobile", detail: "Must match owner records." },
          { title: "Pay via UPI", detail: "Enter the amount you are paying." },
          { title: "Submit UTR", detail: "Owner approves like a normal tenant submission." },
        ],
        tips: [
          "For full dues breakdown and history, ask the owner for a tenant login.",
        ],
      },
    ],
  },
  {
    id: "receipts",
    title: "Receipts",
    description: "Proof of payment after owner approval.",
    items: [
      {
        id: "view-receipts",
        question: "Where are my receipts?",
        answer:
          "Menu → Receipts. Each approved payment gets a unique receipt number and PDF you can download or share.",
        mockup: "receipts",
        steps: [
          { title: "Open Receipts", detail: "List shows month, amount, receipt number." },
          { title: "Tap a receipt", detail: "View breakdown (rent, charges, electricity)." },
          { title: "Download PDF", detail: "Save or share on WhatsApp if needed." },
        ],
      },
    ],
  },
  {
    id: "electricity",
    title: "Electricity",
    description: "View bills — pay via Pay rent with your monthly dues.",
    items: [
      {
        id: "electricity-bills",
        question: "How do I see and pay electricity?",
        answer:
          "Menu → Electricity shows recent bills (units and amount). Pay electricity together with rent on the Pay rent page — it is included in the monthly breakdown.",
        mockup: "electricity",
        tips: [
          "Do not pay electricity separately unless the owner asks you to.",
          "Final month after vacating may still show an electricity balance.",
        ],
      },
    ],
  },
  {
    id: "maintenance",
    title: "Maintenance",
    description: "Report issues in your flat.",
    items: [
      {
        id: "report-issue",
        question: "How do I report a repair?",
        answer:
          "Menu → Maintenance → fill title, description, priority, and category → Submit. The owner updates status when work is scheduled or completed.",
        mockup: "maintenance",
        steps: [
          { title: "Describe the problem", detail: "e.g. Kitchen tap leaking" },
          { title: "Choose priority", detail: "Normal or Urgent" },
          { title: "Submit", detail: "Track status on the same page." },
        ],
        tips: ["For emergencies (major leak, no power), call the owner directly too."],
      },
    ],
  },
  {
    id: "move-out",
    title: "Move out & transfer",
    description: "Give notice before leaving or changing flats.",
    items: [
      {
        id: "vacate",
        question: "How do I request to move out?",
        answer:
          "Menu → Move / transfer → choose Move out, add reason and preferred date → Submit. The owner sets the official vacate date and confirms final dues.",
        mockup: "vacate",
        steps: [
          { title: "Submit notice", detail: "Move / transfer → Move out" },
          { title: "Pay final month", detail: "Rent + electricity may still be due after notice." },
          { title: "Owner confirms", detail: "Vacate date is recorded; flat becomes vacant." },
        ],
        tips: [
          "Submit notice before your last month to avoid confusion on final dues.",
        ],
      },
      {
        id: "transfer",
        question: "Can I move to another flat in the same building?",
        answer:
          "Yes — choose Transfer on the Move / transfer page and mention your preferred flat. The owner approves and updates your tenancy.",
        mockup: "vacate",
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Common problems",
    description: "Quick fixes before contacting the owner.",
    items: [
      {
        id: "no-upi",
        question: "UPI ID or QR is missing on Pay rent",
        answer: "The owner has not set UPI for your flat yet. Ask them to update Admin → Accounts (per-flat UPI) or Admin → Flats → Edit your flat.",
      },
      {
        id: "wrong-amount",
        question: "The amount looks wrong",
        answer:
          "Check the billing month on Pay rent. Dues include rent + monthly charges + electricity. If still wrong, contact the owner with your flat number and month.",
      },
      {
        id: "wrong-name",
        question: "My name is wrong on receipts or the portal",
        answer:
          "Use the form at the top of this Help page (signed in as Tenant). Send the correct name and a short note — spelling mistake, extra initials, or the wrong person. The owner approves it before receipts and the portal update.",
        steps: [
          {
            title: "Open Help while signed in",
            detail: "Menu → Help, or this page after tenant login.",
          },
          {
            title: "Enter the correct name",
            detail: "Add an optional note about what is inconsistent.",
          },
          {
            title: "Wait for approval",
            detail: "The owner reviews the request under Admin → Tenants.",
          },
        ],
        tips: [
          "Not signed in? Tap Sign in first — the form only works with a tenant login.",
        ],
      },
      {
        id: "move-in-month",
        question: "Why is my first month ₹0?",
        answer:
          "The move-in month has no dues by building policy. Rent and charges start from the following calendar month.",
      },
      {
        id: "logout",
        question: "How do I sign out?",
        answer: "Tap Logout at the top right, especially on a shared family phone.",
      },
    ],
  },
];
