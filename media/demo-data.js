// Content for the promotional screenshot. The sessions are representative work,
// not a dump of anyone's real transcript history.
window.DEMO_CONTENT = {
    en: {
        direction: "ltr",
        viewDescription: "All projects",
        groups: [
            {
                label: "Today",
                sessions: [
                    { agent: "claude", title: "Add exponential backoff to the webhook consumer", meta: "Claude · 12 minutes ago", selected: true },
                    { agent: "codex", title: "Draft the schema migration for billing", meta: "Codex · 1 hour ago" },
                    { agent: "claude", title: "Paginate the orders endpoint", meta: "Claude · 2 hours ago" },
                    { agent: "codex", title: "Find why the E2E suite flakes on CI", meta: "Codex · 4 hours ago" },
                ],
            },
            {
                label: "Yesterday",
                sessions: [
                    { agent: "claude", title: "Move auth middleware into a service layer", meta: "Claude · 19 hours ago" },
                    { agent: "codex", title: "Tune the Postgres indexes behind search", meta: "Codex · 21 hours ago" },
                    { agent: "claude", title: "Write the release notes for 2.4.0", meta: "Claude · 23 hours ago" },
                ],
            },
            {
                label: "Previous 7 days",
                sessions: [
                    { agent: "codex", title: "Port the upload widget to design tokens", meta: "Codex · 2 days ago" },
                    { agent: "claude", title: "Trace the memory leak in the worker pool", meta: "Claude · 3 days ago" },
                    { agent: "codex", title: "Set up preview deploys for pull requests", meta: "Codex · 4 days ago" },
                    { agent: "claude", title: "Document the plugin lifecycle hooks", meta: "Claude · 5 days ago" },
                    { agent: "codex", title: "Replace the cron scripts with systemd timers", meta: "Codex · 6 days ago" },
                ],
            },
        ],
        chat: {
            answerZero: "Deliveries to the payment provider spiked from 40/min to 2,100/min at 09:14, and every one of them carries the same idempotency key. That is one request being retried, not real traffic.",
            userFirst: "Which service is retrying the payment webhook so aggressively?",
            answerFirst: "The consumer in consumer/webhook.py. It catches the delivery error, re-queues the task in the same tick, and never widens the gap between attempts — so a single failing endpoint gets hit as fast as the worker can loop.",
            user: "Right. Give it exponential backoff with jitter and stop it after five attempts.",
            lead: "The retry lived inside the task itself, so a failure re-entered the queue on the next tick. I moved the policy into the dispatcher and capped it at five attempts.",
            tools: [
                { name: "Read", detail: "consumer/webhook.py", result: "212 lines" },
                { name: "Edit", detail: "consumer/dispatcher.py", result: "+34 −12" },
                { name: "Bash", detail: "pytest tests/test_webhook.py -q", result: "12 passed" },
            ],
            tail: "Delays now run 1s → 2s → 4s → 8s with full jitter, and the consumer gives up after the fifth attempt instead of looping forever.",
            placeholder: "Reply to Claude…",
            mode: "Accept edits",
        },
    },
    fa: {
        direction: "rtl",
        viewDescription: "همه پروژه‌ها",
        groups: [
            {
                label: "امروز",
                sessions: [
                    { agent: "claude", title: "افزودن تأخیر پلکانی به مصرف‌کننده وبهوک", meta: "Claude · ۱۲ دقیقه پیش", selected: true },
                    { agent: "codex", title: "نوشتن مایگریشن جدول‌های صورتحساب", meta: "Codex · ۱ ساعت پیش" },
                    { agent: "claude", title: "صفحه‌بندی خروجی API سفارش‌ها", meta: "Claude · ۲ ساعت پیش" },
                    { agent: "codex", title: "بررسی ناپایداری تست‌های E2E روی CI", meta: "Codex · ۴ ساعت پیش" },
                ],
            },
            {
                label: "دیروز",
                sessions: [
                    { agent: "claude", title: "انتقال میان‌افزار احراز هویت به لایه سرویس", meta: "Claude · ۱۹ ساعت پیش" },
                    { agent: "codex", title: "بهینه‌سازی ایندکس‌های صفحه جستجو", meta: "Codex · ۲۱ ساعت پیش" },
                    { agent: "claude", title: "نوشتن یادداشت انتشار نسخه ۲.۴.۰", meta: "Claude · ۲۳ ساعت پیش" },
                ],
            },
            {
                label: "۷ روز گذشته",
                sessions: [
                    { agent: "codex", title: "انتقال ویجت آپلود به توکن‌های دیزاین", meta: "Codex · ۲ روز پیش" },
                    { agent: "claude", title: "ردیابی نشت حافظه در استخر کارگرها", meta: "Claude · ۳ روز پیش" },
                    { agent: "codex", title: "راه‌اندازی دیپلوی پیش‌نمایش برای پول‌ریکوئست‌ها", meta: "Codex · ۴ روز پیش" },
                    { agent: "claude", title: "مستندسازی هوک‌های چرخه عمر پلاگین", meta: "Claude · ۵ روز پیش" },
                    { agent: "codex", title: "جایگزینی اسکریپت‌های cron با تایمرهای systemd", meta: "Codex · ۶ روز پیش" },
                ],
            },
        ],
        chat: {
            answerZero: "تعداد درخواست‌ها به سرویس پرداخت ساعت ۹:۱۴ از ۴۰ در دقیقه به ۲۱۰۰ در دقیقه رسیده و همه هم یک کلید یکتای تکراری دارند. یعنی یک درخواست دارد بارها تکرار می‌شود، نه اینکه ترافیک واقعی زیاد شده باشد.",
            userFirst: "کدام سرویس این‌قدر پیاپی وبهوک پرداخت را دوباره صدا می‌زند؟",
            answerFirst: "مصرف‌کننده‌ای که در consumer/webhook.py نوشته شده. خطای تحویل را می‌گیرد، تسک را در همان چرخه دوباره به صف می‌فرستد و هیچ فاصله‌ای بین تلاش‌ها نمی‌گذارد، برای همین یک سرویس خراب به سرعت حلقه کارگر ضربه می‌خورد.",
            user: "درست است. برایش تأخیر پلکانی با پراکندگی تصادفی بگذار و بعد از پنج تلاش متوقفش کن.",
            lead: "تلاش مجدد داخل خود تسک انجام می‌شد، برای همین هر خطا در همان چرخه بعدی به صف برمی‌گشت. سیاست تلاش مجدد را به دیسپچر منتقل کردم و سقف آن را پنج بار گذاشتم.",
            tools: [
                { name: "Read", detail: "consumer/webhook.py", result: "۲۱۲ خط" },
                { name: "Edit", detail: "consumer/dispatcher.py", result: "+۳۴ −۱۲" },
                { name: "Bash", detail: "pytest tests/test_webhook.py -q", result: "۱۲ تست سبز" },
            ],
            tail: "فاصله تلاش‌ها حالا ۱ به ۲ به ۴ به ۸ ثانیه با پراکندگی تصادفی است و مصرف‌کننده بعد از پنجمین تلاش متوقف می‌شود، نه اینکه بی‌نهایت حلقه بزند.",
            placeholder: "پاسخ به کلاد…",
            mode: "پذیرش تغییرات",
        },
    },
};
