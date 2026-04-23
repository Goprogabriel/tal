# Talrum Danmark

Talrum Danmark er en statisk, open source prototype til at udforske Danmarks Statistiks StatBank API på en mere visuel og brugervenlig måde end det klassiske tabel-interface.

Projektet kan hostes gratis på GitHub Pages uden backend og uden build-step. Åbn `index.html` via en lokal webserver, eller publicér roden af repoet direkte på GitHub Pages.

## Funktioner

- Live browsing af StatBank-emner via `subjects`.
- Tabeloversigt via `tables`, både efter emne og senest opdateret.
- Metadata først via `tableinfo`, så variable, koder, enheder og opdateringsdato vises korrekt.
- Dataudtræk via `data` i `JSONSTAT`, som parses til graf, kort, tabel og eksport.
- Celle-estimat, så almindelige udtræk holdes under StatBanks praktiske non-bulk-grænse.
- CSV- og JSON-download af det aktuelle udtræk.
- Centroid-kort for kommune- og regionsdata via Dataforsyningens `struktur=mini`-endpoints.
- Hash-baserede undersider, så GitHub Pages ikke kræver server-side routing.

## Kør lokalt

```bash
python3 -m http.server 4173
```

Åbn derefter `http://127.0.0.1:4173`.

## Host gratis på GitHub Pages

1. Opret et GitHub-repo og push filerne.
2. Gå til `Settings` -> `Pages`.
3. Vælg branch `main` og folder `/root`.
4. GitHub Pages serverer `index.html` direkte.

## Datakilder

- Danmarks Statistik StatBank API: https://www.dst.dk/da/Statistik/hjaelp-til-statistikbanken/api
- StatBank API console: https://api.statbank.dk/console
- Dataforsyningen kommune- og regionscentre: https://api.dataforsyningen.dk

Danmarks Statistiks egne data kan bruges frit, også kommercielt, så længe kilden angives. Det svarer til Creative Commons CC BY 4.0, som DST beskriver i API-dokumentationen.

## Vigtige API-noter

- `subjects`, `tables` og `tableinfo` svarer med JSON eller XML.
- `data` understøtter blandt andet `JSONSTAT`, `CSV`, `BULK`, `XLSX`, `HTML` og `PNG`.
- `catalogue` er et DCAT-AP XML-katalog, men kræver API-nøgle fra Danmarks Statistik.
- Almindelige non-bulk dataudtræk har en cellebegrænsning. Talrum estimerer celler før kaldet og blokerer meget store visualiseringskald.
- Kortvisningen summerer ikke skjulte dimensioner. Hvis et datasæt har flere ikke-geografiske værdier pr. geografisk punkt, beder UI'et brugeren indsnævre valget i stedet.

## Licens

Koden i dette repo er MIT-licenseret. Data kommer fra de angivne offentlige kilder og skal krediteres separat.
