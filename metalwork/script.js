/* =====================================================================
   Логика сайта: подстановка данных из config.js, меню, галерея, форма
   ===================================================================== */
(function () {
  "use strict";

  var C = window.SITE || {};
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (t) {
    return String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };
  var digits = function (v) { return String(v || "").replace(/\D/g, ""); };

  /* Блоки подстановки данных обёрнуты в try/catch: ошибка в config.js
     не должна ломать меню, навигацию и показ секций. */
  try {

  /* ------------------------- 1. Текстовые поля ----------------------- */
  var values = {
    company:      C.company,
    companyShort: C.companyShort,
    city:         C.city,
    region:       C.region,
    phoneDisplay: C.phoneDisplay,
    address:      C.address,
    hours:        C.hours,
    email:        C.email,
    aboutText:    C.aboutText,
    "years-text": C.years,
    "years-plus": C.years ? C.years + "+" : null,
    title:        C.company ? C.company + " — металлоконструкции и изделия из металла на заказ" : null,
    "og-title":   C.company ? C.company + " — металлоконструкции на заказ" : null
  };

  $$("[data-cfg]").forEach(function (el) {
    var v = values[el.getAttribute("data-cfg")];
    if (!v) return;
    if (el.tagName === "META") el.setAttribute("content", v);
    else el.textContent = v;
  });

  /* --------------------------- 2. Ссылки ----------------------------- */
  var tel  = digits(C.phoneRaw);
  var wa   = digits(C.whatsapp);
  var tg   = String(C.telegram || "").replace(/^@/, "").trim();
  var waMsg = encodeURIComponent(
    "Здравствуйте! Пишу с сайта" + (C.company ? " «" + C.company + "»" : "") + ". Хочу узнать стоимость."
  );

  var links = {
    tel:      tel ? "tel:+" + tel : null,
    whatsapp: wa  ? "https://wa.me/" + wa + "?text=" + waMsg : null,
    telegram: tg  ? "https://t.me/" + tg : null
  };

  $$("[data-cfg-href]").forEach(function (el) {
    var href = links[el.getAttribute("data-cfg-href")];
    if (!href) return;                       // не заполнено — остаётся якорь #contacts
    el.setAttribute("href", href);
    if (href.indexOf("http") === 0) { el.target = "_blank"; el.rel = "noopener"; }
  });

  if (tg) { var tgBtn = $('[data-row="telegram"]'); if (tgBtn) tgBtn.hidden = false; }
  if (C.email) {
    var eRow = $('[data-row="email"]');
    if (eRow) { eRow.hidden = false; var b = $("[data-cfg='email']", eRow); if (b) b.textContent = C.email; }
  }

  /* ---------------------------- 3. Цены ------------------------------ */
  Object.keys(C.prices || {}).forEach(function (key) {
    var item = C.prices[key] || {};
    var priceEl = $('[data-price="' + key + '"]');
    var noteEl  = $('[data-price-note="' + key + '"]');
    if (priceEl && item.price) priceEl.textContent = item.price;
    if (noteEl && item.note)  { noteEl.textContent = item.note; noteEl.hidden = false; }
  });

  /* -------------------- 4. Факты в блоке «О компании» ---------------- */
  var factsEl = $("#facts");
  if (factsEl && Array.isArray(C.facts)) {
    factsEl.innerHTML = C.facts.map(function (f) {
      return "<li><b>" + esc(f.value) + "</b><span>" + esc(f.label) + "</span></li>";
    }).join("");
  }

  /* --------------------------- 5. Шаги ------------------------------- */
  var stepsEl = $("#steps");
  if (stepsEl && Array.isArray(C.steps)) {
    stepsEl.innerHTML = C.steps.map(function (s) {
      return "<li class=\"reveal\"><h3>" + esc(s.title) + "</h3><p>" + esc(s.text) + "</p></li>";
    }).join("");
  }

  /* -------------------------- 6. Галерея ----------------------------- */
  var galleryEl = $("#gallery");
  var worksSection = $("#works");
  var withPhoto = (Array.isArray(C.works) ? C.works : []).filter(function (w) { return w.img; });

  if (galleryEl && withPhoto.length) {
    galleryEl.innerHTML = withPhoto.map(function (w) {
      return '<figure class="gallery-item reveal">' +
               '<span class="gallery-media">' +
                 '<img src="' + esc(w.img) + '" alt="' + esc(w.title) + '" loading="lazy">' +
               '</span>' +
               '<figcaption>' + esc(w.title) + '</figcaption>' +
             '</figure>';
    }).join("");
  } else if (worksSection) {
    // фотографий ещё нет — прячем раздел и пункт меню, чтобы не показывать
    // клиенту пустые квадраты. Раздел вернётся сам, как только появится фото.
    worksSection.hidden = true;
    var worksLink = document.querySelector('.nav a[href="#works"]');
    if (worksLink) worksLink.hidden = true;
  }

  } catch (err) {
    if (window.console) console.error("Ошибка в config.js:", err);
  }

  /* -------------------- 7. Мобильное меню и скролл-спай -------------- */
  var burger = $("#burger"), nav = $("#nav");
  function closeMenu() {
    if (!nav) return;
    nav.classList.remove("is-open");
    if (burger) burger.setAttribute("aria-expanded", "false");
  }
  if (burger && nav) {
    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function (e) { if (e.target.tagName === "A") closeMenu(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
    window.addEventListener("resize", function () { if (window.innerWidth > 860) closeMenu(); });
  }

  var navLinks = $$(".nav a");
  var sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute("href")); })
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------------------- 8. Появление при скролле -------------------- */
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var revealEls = $$(".reveal");
  if (reduced || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        // показываем, когда элемент попал в экран ИЛИ когда его уже пролистали
        // вверх (при быстром скролле браузер может не успеть сообщить о входе)
        if (!en.isIntersecting && en.boundingClientRect.top > 0) return;
        en.target.classList.add("is-in");
        obs.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    revealEls.forEach(function (el) { io.observe(el); });

    // Страховка: если через 1.5 с не проявился ни один блок, значит наблюдатель
    // в этом браузере не сработал — показываем всё, пустой страницы быть не должно.
    setTimeout(function () {
      var shown = document.querySelector(".reveal.is-in");
      if (!shown) revealEls.forEach(function (el) { el.classList.add("is-in"); });
    }, 1500);
  }

  /* ------------------------- 9. Форма заявки -------------------------- */
  var form = $("#lead-form"), note = $("#form-note"), noteBase = note ? note.textContent : "";
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      var fields = { name: form.querySelector('[name="name"]'), phone: form.querySelector('[name="phone"]') };
      Object.keys(fields).forEach(function (k) {
        var el = fields[k];
        var bad = k === "phone" ? digits(el.value).length < 10 : el.value.trim().length < 2;
        el.classList.toggle("invalid", bad);
        if (bad) ok = false;
      });
      if (!ok) {
        if (note) { note.textContent = "Укажите имя и телефон — без них мы не сможем перезвонить."; note.classList.add("error"); }
        return;
      }
      if (note) { note.textContent = noteBase; note.classList.remove("error"); }

      var msg = form.querySelector('[name="message"]').value.trim();
      var text =
        "Заявка с сайта" + (C.company ? " «" + C.company + "»" : "") + "\n" +
        "Имя: " + fields.name.value.trim() + "\n" +
        "Телефон: " + fields.phone.value.trim() +
        (msg ? "\nЗадача: " + msg : "");

      if (wa) {
        window.open("https://wa.me/" + wa + "?text=" + encodeURIComponent(text), "_blank", "noopener");
      } else if (note) {
        note.textContent = "Номер WhatsApp пока не указан в config.js — заполните поле whatsapp.";
        note.classList.add("error");
      }
    });

    $$("#lead-form input").forEach(function (el) {
      el.addEventListener("input", function () { el.classList.remove("invalid"); });
    });
  }

  /* ---------------------------- 10. Год ------------------------------- */
  var y = $("#year");
  if (y) y.textContent = new Date().getFullYear();
})();
