import { html, pageHeader } from '../core/dom.js';

export function renderApiPage(main) {
  main.replaceChildren(pageHeader(
    'API & kilder',
    'Sådan bruger projektet DST korrekt og hvad der er vigtigt for datakvalitet.'
  ), html(`
    <div class="api-page">
      <section class="docs-grid">
        <article class="doc-card">
          <span class="panel-number">subjects</span>
          <h2>Emnehierarki</h2>
          <p>Bruges til at vise hovedemner og finde tabeller inden for et emne.</p>
          <code>POST https://api.statbank.dk/v1/subjects</code>
        </article>
        <article class="doc-card">
          <span class="panel-number">tables</span>
          <h2>Tabelkatalog</h2>
          <p>Returnerer tabel-id, titel, enhed, opdateringsdato og variable. Kan filtreres med emner eller seneste dage.</p>
          <code>POST https://api.statbank.dk/v1/tables</code>
        </article>
        <article class="doc-card">
          <span class="panel-number">tableinfo</span>
          <h2>Metadata først</h2>
          <p>Siden læser altid metadata før data, fordi variable, værdi-koder, enhed, note og kort-metadata kommer herfra.</p>
          <code>POST https://api.statbank.dk/v1/tableinfo</code>
        </article>
        <article class="doc-card">
          <span class="panel-number">data</span>
          <h2>JSON-stat til visning</h2>
          <p>Visualiseringer hentes i JSONSTAT, så dimensioner og værdier kan matches korrekt i browseren.</p>
          <code>POST https://api.statbank.dk/v1/data</code>
        </article>
        <article class="doc-card">
          <span class="panel-number">catalogue</span>
          <h2>DCAT-AP kræver nøgle</h2>
          <p>catalogue leverer et XML-katalog til fx Datavejviser, men DST kræver API-nøgle. Siden bruger derfor de åbne metadata-kald til normal browsing.</p>
          <code>POST https://api.statbank.dk/v1/catalogue</code>
        </article>
        <article class="doc-card">
          <span class="panel-number">kort</span>
          <h2>Geografi</h2>
          <p>StatBank fortæller hvilken variabel der er geografisk. Talrum matcher kommune- og regionskoder med Dataforsyningens visuelle centre.</p>
          <code>GET https://api.dataforsyningen.dk/kommuner?struktur=mini</code>
        </article>
      </section>

      <section class="source-panel">
        <h2>Datakvalitet i denne prototype</h2>
        <p>
          Siden summerer ikke skjulte dimensioner. Hvis et kort ville kræve flere
          ikke-geografiske værdier på samme punkt, beder den brugeren vælge én værdi
          i stedet for at vise en misvisende boble. Celle-estimatet beskytter mod
          for store almindelige udtræk.
        </p>
        <div class="source-links">
          <a href="https://www.dst.dk/da/Statistik/hjaelp-til-statistikbanken/api" target="_blank" rel="noreferrer">DST API dokumentation</a>
          <a href="https://api.statbank.dk/console#subjects" target="_blank" rel="noreferrer">subjects console</a>
          <a href="https://api.statbank.dk/console#tables" target="_blank" rel="noreferrer">tables console</a>
          <a href="https://api.statbank.dk/console#tableinfo" target="_blank" rel="noreferrer">tableinfo console</a>
          <a href="https://api.statbank.dk/console#data" target="_blank" rel="noreferrer">data console</a>
          <a href="https://api.statbank.dk/console#catalogue" target="_blank" rel="noreferrer">catalogue console</a>
        </div>
      </section>
    </div>
  `));
}
