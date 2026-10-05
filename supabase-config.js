"use strict";

/* ========================================================================
 * SHARED THIRD-PARTY SERVICE CONFIG
 * ------------------------------------------------------------------------
 * Loaded by BOTH index.html (the storefront) and admin.html (the owner's
 * admin dashboard), so you only need to fill in these values ONCE.
 *
 *  1) SUPABASE -> used for:
 *     a) storing uploaded customer design images (Storage bucket:
 *        SUPABASE_DESIGNS_BUCKET) so they can be emailed as a short link
 *     b) storing product photos the owner uploads from the admin
 *        dashboard (Storage bucket: SUPABASE_PRODUCTS_BUCKET)
 *     c) storing live product price/image data (Table:
 *        SUPABASE_PRODUCTS_TABLE) that the storefront reads on page load
 *        and the admin dashboard edits
 *     d) storing branding/gallery/ornament design photos (Table:
 *        SUPABASE_SITE_ASSETS_TABLE)
 *     e) storing customer feedback submissions (Table:
 *        SUPABASE_FEEDBACK_TABLE) so the owner can review them in
 *        admin.html
 *     f) the admin login itself (Supabase Auth), including the
 *        "Forgot password" email flow
 *     g) the public "Reviews" section on the storefront (View:
 *        SUPABASE_REVIEWS_TABLE) -- a read-only view of only the feedback
 *        entries the owner has toggled "Publish as review" in admin.html,
 *        with the customer's email address masked (e.g. "ja**@example.com")
 *        rather than ever exposed in full
 *     h) storing the Ceramic Ornament design options (Table:
 *        SUPABASE_ORNAMENT_DESIGNS_TABLE) -- shapes like "Circle" or "Star"
 *        the owner can add, rename, or remove from admin.html, which
 *        customers then pick from when customizing a Ceramic Ornament
 *
 *     Setup steps:
 *     - Create a free project at https://supabase.com
 *     - Project Settings > API gives you the Project URL and anon public key
 *     - Run the SQL in supabase-admin-setup.sql (once) in the Supabase
 *       SQL Editor to create the tables + storage buckets + the security
 *       policies that let the storefront READ data but only a logged-in
 *       admin can WRITE/update it
 *     - Authentication > Users > Add User to create the one owner login
 *       (email + password) used to sign in to admin.html
 *     - Authentication > URL Configuration > Redirect URLs: add the URL
 *       where you host admin.html (e.g. https://yourname.github.io/repo/admin.html)
 *       so the "Forgot password" reset link is allowed to redirect back to it
 *
 *  2) EMAILJS -> sends orders, feedback, contact messages, and password
 *     reset notifications straight to your inbox automatically. THREE
 *     separate EmailJS accounts are used here (each account only gets one
 *     connected email service on the free plan):
 *
 *     ACCOUNT 1 -> orders (owner notification) + the "Contact Us" form
 *       - EMAILJS_ACCOUNT_1_PUBLIC_KEY / EMAILJS_ACCOUNT_1_SERVICE_ID
 *       - EMAILJS_ORDER_TEMPLATE_ID    -> variables: {{order_number}}
 *         {{customer_name}} {{customer_email}} {{items_summary}}
 *         {{order_total}} {{item_count}}
 *       - EMAILJS_CONTACT_TEMPLATE_ID  -> variables: {{customer_name}}
 *         {{customer_email}} {{message}}
 *
 *     ACCOUNT 2 -> customer feedback request + admin password-reset
 *     notifications
 *       - EMAILJS_ACCOUNT_2_PUBLIC_KEY / EMAILJS_ACCOUNT_2_SERVICE_ID
 *       - EMAILJS_FEEDBACK_TEMPLATE_ID      -> variables: {{customer_name}}
 *         {{customer_email}} {{rating}} {{message}}
 *       - EMAILJS_RESET_NOTIFY_TEMPLATE_ID  -> variables:
 *         {{account_email}} {{requested_at}}
 *         (this is just an FYI email to you whenever someone requests a
 *         password reset on admin.html -- the actual secure reset link is
 *         always sent by Supabase itself, not EmailJS)
 *
 *     ACCOUNT 3 -> order auto-reply (to the customer) + feedback replies
 *     (to the customer)
 *       - EMAILJS_ACCOUNT_3_PUBLIC_KEY / EMAILJS_ACCOUNT_3_SERVICE_ID
 *       - EMAILJS_ORDER_AUTOREPLY_TEMPLATE_ID -> variables: {{order_number}}
 *         {{customer_name}} {{customer_email}} {{items_summary}}
 *         {{order_total}} {{item_count}}
 *         Sent automatically to the CUSTOMER right after they place an
 *         order, confirming it was received (separate from the owner
 *         notification email sent via Account 1). "To Email" in this
 *         EmailJS template must be set to {{customer_email}}. See
 *         email-templates/order-auto-reply.html for ready-to-paste HTML.
 *       - EMAILJS_FEEDBACK_REPLY_TEMPLATE_ID -> variables: {{customer_name}}
 *         {{customer_email}} {{original_message}} {{reply_message}}
 *         Sent when the owner clicks "Send Reply" on a feedback entry in
 *         admin.html. IMPORTANT: like the order auto-reply above, this one
 *         emails OUT to the customer, not in to you -- in the EmailJS
 *         template's own settings (not this file), set "To Email" to
 *         {{customer_email}} instead of your own address. See
 *         email-templates/feedback-reply.html for ready-to-paste HTML.
 *
 * Until these are filled in, everything keeps working the old way:
 * the storefront shows its built-in hardcoded prices/photos, designs
 * stay only in the browser (not emailed), orders/feedback/contact open as
 * a draft in the customer's own email app, and admin.html shows a "finish
 * setup" notice instead of a login form.
 * ====================================================================== */
const SUPABASE_URL = "https://vhpsdwsfexnwcvtjbswk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3w8cJp6MxaKf1nFoxgazJw__fFK5RdV";
const SUPABASE_DESIGNS_BUCKET = "designs";
const SUPABASE_PRODUCTS_BUCKET = "product-images";
const SUPABASE_PRODUCTS_TABLE = "products";
const SUPABASE_SITE_ASSETS_BUCKET = "site-assets";
const SUPABASE_SITE_ASSETS_TABLE = "site_assets";
const SUPABASE_FEEDBACK_TABLE = "feedback";

// Read-only view (see supabase-admin-setup.sql) that only exposes feedback
// rows the owner has marked "Publish as review" -- and only the safe,
// non-sensitive columns (no email address) -- so the public storefront can
// safely read it with the anon key.
const SUPABASE_REVIEWS_TABLE = "published_reviews";

// The Ceramic Ornament design options (shapes like "Circle"/"Star") the
// owner manages from admin.html -- customers pick one of these when
// customizing a Ceramic Ornament. A normal addable/removable table, unlike
// the fixed logo/hero/gallery rows in SUPABASE_SITE_ASSETS_TABLE.
const SUPABASE_ORNAMENT_DESIGNS_TABLE = "ornament_designs";

// Extra/alternate photos per product (on top of each product's main
// "image_url"), shown as clickable thumbnails on the storefront and in the
// Customize popup. Owner-managed, unlimited per product, from admin.html.
const SUPABASE_PRODUCT_GALLERY_TABLE = "product_gallery_images";

// ---- EmailJS Account 1: orders (owner notification) + contact form -------
const EMAILJS_ACCOUNT_1_PUBLIC_KEY = "RqKFWxsBxrbdt_hCY";
const EMAILJS_ACCOUNT_1_SERVICE_ID = "service_lv1ldvg";
const EMAILJS_ORDER_TEMPLATE_ID = "template_q39g72s";
const EMAILJS_CONTACT_TEMPLATE_ID = "template_h3p6j3l";

// ---- EmailJS Account 2: feedback request + admin reset-password notify ---
const EMAILJS_ACCOUNT_2_PUBLIC_KEY = "n2siGwvWOa4o4N2a8";
const EMAILJS_ACCOUNT_2_SERVICE_ID = "service_wdfomfq";
const EMAILJS_FEEDBACK_TEMPLATE_ID = "template_e6f8qbn";
const EMAILJS_RESET_NOTIFY_TEMPLATE_ID = "template_38q2z6b";

// ---- EmailJS Account 3: order auto-reply + feedback reply (both to the
// customer, not the owner) --------------------------------------------------
const EMAILJS_ACCOUNT_3_PUBLIC_KEY = "UF652aA_m_bBTyoX4";
const EMAILJS_ACCOUNT_3_SERVICE_ID = "service_gx1izcb";
const EMAILJS_ORDER_AUTOREPLY_TEMPLATE_ID = "template_70ohlhh";
const EMAILJS_FEEDBACK_REPLY_TEMPLATE_ID = "template_kefttk7";

function isSupabaseConfigured() {
  return (
    SUPABASE_URL.indexOf("YOUR_") !== 0 &&
    SUPABASE_ANON_KEY.indexOf("YOUR_") !== 0
  );
}

function isOrderEmailConfigured() {
  return (
    EMAILJS_ACCOUNT_1_PUBLIC_KEY.indexOf("YOUR_") !== 0 &&
    EMAILJS_ACCOUNT_1_SERVICE_ID.indexOf("YOUR_") !== 0 &&
    EMAILJS_ORDER_TEMPLATE_ID.indexOf("YOUR_") !== 0
  );
}

function isContactEmailConfigured() {
  return (
    EMAILJS_ACCOUNT_1_PUBLIC_KEY.indexOf("YOUR_") !== 0 &&
    EMAILJS_ACCOUNT_1_SERVICE_ID.indexOf("YOUR_") !== 0 &&
    EMAILJS_CONTACT_TEMPLATE_ID.indexOf("YOUR_") !== 0
  );
}

function isFeedbackEmailConfigured() {
  return (
    EMAILJS_ACCOUNT_2_PUBLIC_KEY.indexOf("YOUR_") !== 0 &&
    EMAILJS_ACCOUNT_2_SERVICE_ID.indexOf("YOUR_") !== 0 &&
    EMAILJS_FEEDBACK_TEMPLATE_ID.indexOf("YOUR_") !== 0
  );
}

function isResetNotifyConfigured() {
  return (
    EMAILJS_ACCOUNT_2_PUBLIC_KEY.indexOf("YOUR_") !== 0 &&
    EMAILJS_ACCOUNT_2_SERVICE_ID.indexOf("YOUR_") !== 0 &&
    EMAILJS_RESET_NOTIFY_TEMPLATE_ID.indexOf("YOUR_") !== 0
  );
}

// Lets the owner reply to a customer's feedback straight from admin.html --
// the reply email goes OUT to the customer (not in to the owner like the
// other templates), so this EmailJS template's "To Email" setting must be
// configured as {{customer_email}} -- see email-templates/feedback-reply.html.
function isFeedbackReplyConfigured() {
  return (
    EMAILJS_ACCOUNT_3_PUBLIC_KEY.indexOf("YOUR_") !== 0 &&
    EMAILJS_ACCOUNT_3_SERVICE_ID.indexOf("YOUR_") !== 0 &&
    EMAILJS_FEEDBACK_REPLY_TEMPLATE_ID.indexOf("YOUR_") !== 0
  );
}

// Sends the customer a "we got your order" confirmation right after they
// place it, separate from (and in addition to) the owner's own order
// notification email sent via Account 1. Also emails OUT to the customer,
// so "To Email" in this EmailJS template must be {{customer_email}}.
function isOrderAutoReplyConfigured() {
  return (
    EMAILJS_ACCOUNT_3_PUBLIC_KEY.indexOf("YOUR_") !== 0 &&
    EMAILJS_ACCOUNT_3_SERVICE_ID.indexOf("YOUR_") !== 0 &&
    EMAILJS_ORDER_AUTOREPLY_TEMPLATE_ID.indexOf("YOUR_") !== 0
  );
}

let sharedSupabaseClient = null;

function getSupabaseClient() {
  if (!isSupabaseConfigured() || !window.supabase) {
    return null;
  }

  if (!sharedSupabaseClient) {
    sharedSupabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
  }

  return sharedSupabaseClient;
}
