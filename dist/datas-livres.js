/* Calendário de datas livres da Banda 3 em 1.
   Mostra só livre/ocupado (nunca o nome do evento) e gera uma lista para colar no WhatsApp.
   Dias ocupados = shows de assets/agenda.json + datas de assets/bloqueios.json. */
(function () {
  "use strict";
  var MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  var MESES_CURTOS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  var DIAS = ["dom","seg","ter","qua","qui","sex","sáb"];
  var MESES_A_FRENTE = 18;

  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  // Seg a qui = meio da semana (amarelo). Sex, sáb e dom = fim de semana (verde).
  function meioDaSemana(d) { var w = d.getDay(); return w >= 1 && w <= 4; }

  function diasOcupados(eventos, bloqueios) {
    var set = new Set();
    (eventos || []).forEach(function (ev) {
      var ini = parse(ev.data); if (!ini) return;
      var fim = parse(ev.dataFim) || ini;
      for (var d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) set.add(iso(d));
    });
    (bloqueios || []).forEach(function (s) { if (parse(s)) set.add(s); });
    return set;
  }

  async function lerJson(url) {
    try {
      var r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }

  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "class") n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) { if (f) n.appendChild(f); });
    return n;
  }

  function textoWhatsApp(ocupados, deMes, ateMes, incluirSemana, hoje) {
    var linhas = [];
    var ini = new Date(deMes.getFullYear(), deMes.getMonth(), 1);
    var fim = new Date(ateMes.getFullYear(), ateMes.getMonth() + 1, 0);
    var titulo = ini.getMonth() === fim.getMonth() && ini.getFullYear() === fim.getFullYear()
      ? MESES_CURTOS[ini.getMonth()] + "/" + ini.getFullYear()
      : MESES_CURTOS[ini.getMonth()] + "/" + ini.getFullYear() + " a " + MESES_CURTOS[fim.getMonth()] + "/" + fim.getFullYear();
    linhas.push("🎸 *Banda 3 em 1 · Datas livres*");
    linhas.push("📅 " + titulo + (incluirSemana ? "" : " (sexta a domingo)"));
    var total = 0;
    for (var m = new Date(ini); m <= fim; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      var semanas = [], semana = [];
      var ultimo = new Date(m.getFullYear(), m.getMonth() + 1, 0);
      for (var d = new Date(m); d <= ultimo; d.setDate(d.getDate() + 1)) {
        var livre = d >= hoje && !ocupados.has(iso(d)) && (incluirSemana || !meioDaSemana(d));
        if (livre) semana.push(String(d.getDate()).padStart(2, "0") + " " + DIAS[d.getDay()]);
        // Fecha a linha no domingo: cada linha = uma semana.
        if (d.getDay() === 0 && semana.length) { semanas.push(semana); semana = []; }
      }
      if (semana.length) semanas.push(semana);
      linhas.push("");
      linhas.push("*" + MESES[m.getMonth()].toUpperCase() + " " + m.getFullYear() + "*");
      if (!semanas.length) linhas.push("Sem datas livres");
      semanas.forEach(function (s) { total += s.length; linhas.push("• " + s.join(" · ")); });
    }
    linhas.push("");
    linhas.push("Agenda atualizada: banda3em1.github.io/#datas-livres");
    return { texto: linhas.join("\n"), total: total };
  }

  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); return true; } catch (e) {}
    var t = el("textarea", { readonly: "" }); t.value = texto;
    t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
    t.remove(); return ok;
  }

  function montar(raiz, opcoes) {
    opcoes = opcoes || {};
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var primeiroMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    var ultimoMes = new Date(hoje.getFullYear(), hoje.getMonth() + MESES_A_FRENTE, 1);
    var ocupados = new Set();
    var inicio = new Date(primeiroMes);

    var legenda = el("ul", { class: "dl-legenda", "aria-label": "Legenda" }, [
      el("li", {}, [el("span", { class: "dl-bolinha dl-livre" }), document.createTextNode("Livre (sex a dom)")]),
      el("li", {}, [el("span", { class: "dl-bolinha dl-semana" }), document.createTextNode("Livre (seg a qui)")]),
      el("li", {}, [el("span", { class: "dl-bolinha dl-ocupado" }), document.createTextNode("Ocupado")])
    ]);
    var btAnt = el("button", { type: "button", class: "dl-nav", "aria-label": "Meses anteriores", text: "‹" });
    var btProx = el("button", { type: "button", class: "dl-nav", "aria-label": "Próximos meses", text: "›" });
    var meses = el("div", { class: "dl-meses" });
    var cal = el("div", { class: "dl-cal" }, [el("div", { class: "dl-topo" }, [btAnt, legenda, btProx]), meses]);

    var selDe = el("select", { id: "dl-de" }), selAte = el("select", { id: "dl-ate" });
    for (var m = new Date(primeiroMes); m <= ultimoMes; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      var rot = MESES[m.getMonth()].charAt(0).toUpperCase() + MESES[m.getMonth()].slice(1) + " " + m.getFullYear();
      var v = iso(m);
      selDe.appendChild(el("option", { value: v, text: rot }));
      selAte.appendChild(el("option", { value: v, text: rot }));
    }
    // Padrão: deste mês até julho do ano que vem (1º semestre seguinte).
    var padraoAte = new Date(hoje.getMonth() >= 6 ? hoje.getFullYear() + 1 : hoje.getFullYear(), 6, 1);
    if (padraoAte < primeiroMes) padraoAte = new Date(primeiroMes.getFullYear(), primeiroMes.getMonth() + 5, 1);
    selAte.value = iso(padraoAte);
    var chkSemana = el("input", { type: "checkbox", id: "dl-semana" });
    var btCopiar = el("button", { type: "button", class: "btn btn-primary btn-sm dl-copiar", text: "Copiar datas livres para o WhatsApp" });
    var aviso = el("p", { class: "dl-aviso", role: "status", "aria-live": "polite" });
    var painel = el("div", { class: "dl-painel" }, [
      el("p", { class: "dl-painel-titulo", text: "Lista de datas livres" }),
      el("div", { class: "dl-campos" }, [
        el("label", { for: "dl-de" }, [document.createTextNode("De"), selDe]),
        el("label", { for: "dl-ate" }, [document.createTextNode("Até"), selAte])
      ]),
      el("label", { class: "dl-check", for: "dl-semana" }, [chkSemana, document.createTextNode("Incluir segunda a quinta")]),
      btCopiar, aviso
    ]);
    raiz.replaceChildren(el("div", { class: "dl-grade" }, [cal, painel]));

    function porVez() { return window.matchMedia("(min-width: 768px)").matches ? 2 : 1; }
    function desenhar() {
      meses.replaceChildren();
      var n = porVez();
      var maxInicio = new Date(ultimoMes.getFullYear(), ultimoMes.getMonth() - n + 1, 1);
      if (inicio > maxInicio) inicio = maxInicio;
      if (inicio < primeiroMes) inicio = new Date(primeiroMes);
      btAnt.disabled = inicio <= primeiroMes;
      btProx.disabled = inicio >= maxInicio;
      for (var i = 0; i < n; i++) {
        var mes = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
        var grade = el("div", { class: "dl-dias", role: "grid" });
        ["D","S","T","Q","Q","S","S"].forEach(function (l) { grade.appendChild(el("span", { class: "dl-cab", "aria-hidden": "true", text: l })); });
        for (var b = 0; b < mes.getDay(); b++) grade.appendChild(el("span", { class: "dl-vazio" }));
        var ult = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
        for (var dia = 1; dia <= ult; dia++) {
          var d = new Date(mes.getFullYear(), mes.getMonth(), dia);
          var passado = d < hoje, ocupado = ocupados.has(iso(d));
          var classe = passado ? "dl-passado" : ocupado ? "dl-ocupado" : meioDaSemana(d) ? "dl-semana" : "dl-livre";
          var estado = passado ? "já passou" : ocupado ? "ocupado" : "livre";
          grade.appendChild(el("span", { class: "dl-dia " + classe + (+d === +hoje ? " dl-hoje" : ""), title: estado, "aria-label": dia + " de " + MESES[mes.getMonth()] + ": " + estado, text: String(dia) }));
        }
        meses.appendChild(el("div", { class: "dl-mes" }, [el("p", { class: "dl-mes-nome", text: MESES[mes.getMonth()] + " " + mes.getFullYear() }), grade]));
      }
    }
    btAnt.addEventListener("click", function () { inicio = new Date(inicio.getFullYear(), inicio.getMonth() - porVez(), 1); desenhar(); });
    btProx.addEventListener("click", function () { inicio = new Date(inicio.getFullYear(), inicio.getMonth() + porVez(), 1); desenhar(); });
    window.matchMedia("(min-width: 768px)").addEventListener("change", desenhar);
    selDe.addEventListener("change", function () { if (selAte.value < selDe.value) selAte.value = selDe.value; });
    selAte.addEventListener("change", function () { if (selAte.value < selDe.value) selDe.value = selAte.value; });
    btCopiar.addEventListener("click", async function () {
      var r = textoWhatsApp(ocupados, parse(selDe.value), parse(selAte.value), chkSemana.checked, hoje);
      var ok = await copiar(r.texto);
      aviso.textContent = ok ? "Copiado! " + r.total + " datas livres. É só colar no WhatsApp." : "Não deu para copiar automaticamente.";
    });

    async function carregar() {
      var agenda = opcoes.agenda || await lerJson(opcoes.agendaUrl || "assets/agenda.json");
      var bloq = opcoes.bloqueios || await lerJson(opcoes.bloqueiosUrl || "assets/bloqueios.json");
      var eventos = (agenda && agenda.eventos) || opcoes.eventosReserva || [];
      ocupados = diasOcupados(eventos, bloq && bloq.datas);
      desenhar();
    }
    desenhar();
    carregar();
  }

  window.DatasLivres = { montar: montar, textoWhatsApp: textoWhatsApp, diasOcupados: diasOcupados };
})();
