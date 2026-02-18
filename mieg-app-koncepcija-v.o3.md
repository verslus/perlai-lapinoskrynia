**Psichologinių testų platforma – Koncepcija (v0.3)**

## **1. Produkto tikslas**

Sukurti patikimą, greitą ir vartotojui aiškią psichologinių testų platformą, kuri:



- leidžia konsultantams greitai suteikti prieigą klientams,
- pateikia profesionalią rezultatų ataskaitą,
- užtikrina maksimalų privatumo lygį (minimalūs asmens duomenys),
- yra lengvai plečiama iki 20+ testų per 3–6 mėn.,
- turi aiškų valdymą administratoriui ir minimalią klaidų riziką.





**Sėkmės kriterijai:**

1. praktiškai nėra techninių klaidų,
2. sistema veikia greitai ir stabiliai,
3. vartotojui visiškai aišku: kaip atsakyti, kaip pamatyti ataskaitą, kaip grįžti prie rezultatų.
4. konsultantas paprasta matyti klientų rezultatus
5. sistemą tinkama vystyti ir pridėti naujus testus, naujas funkcijas išsaugant veikiančią dalį.

------



## **2. Pagrindiniai naudojimo scenarijai**







### **A) Konsultanto inicijuotas scenarijus (MVP pagrindas)**





1. Konsultantas sugeneruoja klientui prieigą prie testo arba testų rinkinio.
2. Klientas atsidaro nuorodą, patvirtina taisykles ir pildo testą.
3. Klientas mato rezultatų ataskaitą.
4. Konsultantas savo valdymo skydelyje mato kliento statusą ir rezultatų suvestinę.

> MVP orientuojamas į šį scenarijų, nes jis yra svarbiausias ir užtikrina aiškų produktinį fokusą.

### **B) Savarankiškas scenarijus (galimas vėliau)**



Viešas vartotojas ateina per bendrą puslapį ir atlieka testą savarankiškai. Šis scenarijus nėra būtinas startui, bet architektūra paliekama taip, kad vėliau jį būtų galima pridėti.



------





## **3. Vartotojų rolės ir erdvės**







### **3.1. Vartotojas (klientas)**





**Tikslas:** patogiai atlikti testą ir suprasti rezultatą.



Funkcijos:



- atidaryti testą per suteiktą prieigą,
- patvirtinti sutikimą (GDPR / taisyklės),
- atlikti testą (pirmas testas: 116 Likert klausimų),
- matyti rezultatų ataskaitą (plati vartotojui),
- atlikus testą pateikti trumpą įvertinimą apie testą (aiškumas / naudingumas / įdomumas),
- matyti ankstesnius rezultatus (paprastas palyginimas: paskutinis vs ankstesnis),
- turėti galimybę ištrinti savo duomenis (su papildomu patvirtinimu).





### **3.2. Konsultantas**

**Tikslas:** greitai suteikti prieigą ir gauti rezultatų suvestinę darbui.

Funkcijos:

- pasirinkti testą arba testų rinkinį ir sugeneruoti klientui nuorodą,

- matyti kliento atlikimo statusą:

  - „nepradėjo / pradėjo / baigė / peržiūrėjo ataskaitą“

  

- matyti 2 ataskaitas:

  - **suvestinė** (konsultantui) – trumpa, darbui
  - **pilna ataskaita** (vartotojui) – jei reikia peržiūrėti

  

- konsultantas kliento nenurodo vardu/pavarde – tik savo sistemos vidiniu „kliento ID“ (pvz., „K-014“).







### **3.3. Administratorius (Super admin)**

**Tikslas:** valdyti testus, kokybę, duomenis, analitiką ir sistemos stabilumą.

Funkcijos:

- kurti / įkelti testus (importas per struktūruotą failą),
- valdyti testų versijas ir kalbas,
- matyti visus rezultatus pagal testą (įskaitant raw answers),
- eksportuoti duomenis (JSON/CSV),
- matyti analitiką (completion rate, avg time, drop-off),
- stebėti sistemos būseną (backup, klaidos),
- gauti pranešimus apie kritines klaidas.

------

## **4. Prieigos ir privatumo modelis („aukso vidurys“)**

### **4.1. Pagrindinis prisijungimo būdas: kliento portalas (ilga nuoroda)**

MVP naudoja **kliento portalą** – ilgą, neįspėjamą nuorodą, kuri atlieka „raktą“ į kliento erdvę:

- vartotojui paprasčiausias būdas,
- nereikia slaptažodžių,
- mažiau klaidų ir mažiau support’o,
- duomenys lieka anoniminiai (portalas susietas su vidiniu ID, ne vardu).



### **4.2. Svarbus reikalavimas: messenger/whatsapp “autopreview”**





Kai kurios programos automatiškai atidaro nuorodą per preview, ir tai gali „sudeginti“ vienkartinius linkus. Todėl:



- kliento portalas **negali būti vienkartinis** vien dėl atidarymo,
- turi būti galimybė **išsiųsti nuorodą dar kartą** (regeneruoti/rotate),
- portalas turi būti atsparus preview (pvz., per tarpinį ekraną pvz. pradėti testą).

### **4.3. El. paštas (pasirinktinai, šifruotas ir atskirai)**



MVP gali turėti opciją vartotojui įvesti el. paštą:

- el. paštas saugomas **atskirai** ir **užšifruotas**,
- naudojamas tik praktiškai: rezultatų kopijai / atstatymui / komunikacijai,
- pagrindinė identifikacija vis tiek lieka per portalą ir vidinius ID.







### **4.4. Minimalūs asmens duomenys – principas**





Sistemoje neturime rinkti:



- vardo, pavardės, gimimo datos, adreso.

  Vartotojas yra anoniminis ID, o duomenų vagystės atveju informacija neturi būti susiejama su realiu žmogumi.





------





## **5. Testų sistema: turinys, kalbos, versijos**







### **5.1. Testų aprašymas**





Testai platformoje yra „turinio paketai“:

- klausimai,
- atsakymų variantai,
- kalbos (min. LT, UA, EN; galimai 4-a),
- skaičiavimo logika (paprasta arba sudėtingos formulės),
- ataskaitų tekstai ir interpretacijos.

### **5.2. Kalbos**

- Nėra hardcoded teksto sistemoje.

- Visa vartotojo matoma informacija yra kalbų failuose / turinio struktūroje.

  



### **5.3. Versijavimas**



Testai turi versijas, kad:

- atlikti rezultatai liktų stabilūs,
- būtų galima tobulinti testą ateityje negriaunant senų bandymų interpretacijos.

------

## **6. Testo atlikimas (UX principai)**

### **6.1. Stabilumas ir aiškumas**

Svarbiausia: vartotojas turi lengvai suprasti ir neužstrigti.



Būtina:

- aiškus progresas,
- automatinis išsaugojimas,
- galimybė turėti tarpinius langus teste, t.y. praneši, kad jis jau atsakė x dalį, liko 2 dalis.
- varianto pasirinkimas veikia kaip kito klausimo užkrovimas arba rezultatų rodymas
- yra mygtukas atgal
- yra mygtukas užduotį klausimą
- galimybė tęsti vėliau.



### **6.2. Attempt „gyvavimo laikas“**



Attempt’as (pildymas ir rezultatas) galioja tol, kol:



- vartotojas ištrina,
- arba admin ištrina.





------

## **7. Ataskaitos ir palyginimas**

### **7.1. Dvi ataskaitos**

1. **Pilna ataskaita vartotojui** – pagrindinė, aiški, su interpretacija.
2. **Suvestinė konsultantui** – trumpa, struktūruota, darbui.

### **7.2. Palyginimas (MVP paprastas)**

Vartotojas ir konsultantas gali matyti paprastą palyginimą:

- paskutinio atlikimo rezultatas
- ankstesnis rezultatas
- pokytis (delta)

Be sudėtingų instrukcijų ar coaching’o – tik bazinis rodymas.

### **7.3. Perskaičiavimas (scoring bug)**

Atsakymai ir rezultatai saugomi atskirai, kad būtų įmanoma:

- retais atvejais (tik didelės klaidos) paleisti perskaičiavimo skriptą,
- kasdienėje veikloje rezultatų „nejudinti“.

------

## **8. Įvertinimo klausimynas po rezultato**

Po ataskaitos vartotojui siūlomas trumpas įvertinimas:

- kiek buvo aišku,
- kiek naudinga,
- kiek įdomu,
- optional komentaras.

Tikslas: produktinis grįžtamasis ryšys, be vartotojo apkrovimo.



------

## **9. Duomenų ištrynimas (GDPR)**

Vartotojas turi turėti savitarnos galimybę:

- „Ištrinti mano duomenis“
- su papildomu patvirtinimu (pvz., įrašyti frazę ar patvirtinti checkbox’ą).

Sistemoje turi būti:

- sutikimo fiksavimas (timestamp + taisyklių versija),
- galimybė eksportuoti adminui (JSON/CSV),
- vartotojui/konsultantui eksportas vėliau per PDF (post-MVP).

------





## **10. Statusai, žurnalai ir minimalus auditas**







### **10.1. Statusai konsultantui**





Konsultantas turi matyti bent:



- nepradėjo (yra prieiga, bet nėra start),
- pradėjo (start užfiksuotas),
- baigė (finish užfiksuotas),
- peržiūrėjo ataskaitą (report_viewed užfiksuotas).
- atsakymai kiek buvo įdomu, vertinga, aišku (ir komentaras jeigu palikta)
- kiek laiko atsakinėjo į klausimus. (kiek minučių atsakinėjo į klausimus)
- kiek laiko susipažino su rezultatais (t.y. kiek minučių skaitė rezultatus)

### **10.2. Minimalus audit log (paaiškinimas)**

Kad galėtume aiškintis klaidas ir turėti kontrolę, fiksuojame įvykius be PII (be vardo, be atviro el. pašto):

Minimalūs event’ai:

- access link sugeneruotas (kas sugeneravo, kuriam testui),
- testas pradėtas,
- atsakymai išsaugoti (periodiškai),
- testas baigtas,
- ataskaita peržiūrėta,
- duomenys ištrinti,
- įvyko scoring/import klaida.

Tai leidžia adminui suprasti „kas nutiko“, jei kažkas neveikia, ir pasiekti tikslą „be techninių klaidų“.

------

## **11. Patikimumas: backup, klaidos, pranešimai**

### **11.1. Backup**

Sistema privalo turėti automatizuotą backup:

- 1 kartą per dieną,
- į atskirą saugyklą (Cloudflare R2),
- saugoti 30 dienų,
- admin turi matyti ar backup sėkmingas.



### **11.2. Klaidų pranešimai adminui**

Jei yra klaidos (scoring, import, sistema), admin turi būti informuojamas. Kanalą (email) parinks techninė komanda, bet reikalavimas – aiškus ir patikimas pranešimas.



------

## **12. Skalė ir apkrova**

Planuojama apkrova:



- 10–20 aktyvių vartotojų vienu metu,
- maksimumas ~50 vienu metu.



Tai leidžia optimizuoti į stabilumą, paprastumą ir aiškų UX, o ne į sudėtingą horizontalų skalavimą.



------





# **Santrauka komandai (1 paragrafas)**





Kuriame daugiakalbę psichologinių testų platformą su 3 rolėmis (vartotojas, konsultantas, super admin), kur pagrindinis srautas yra „konsultantas sugeneruoja klientui portalo nuorodą → klientas atlieka testą → mato pilną ataskaitą → konsultantas mato statusą ir suvestinę“. Sistema prioritetizuoja stabilumą, greitį ir vartotojo aiškumą, o privatumas užtikrinamas minimaliai renkant PII (be vardų, be pavardžių; el. paštas – optional, šifruotas atskirai). Testai keliomis kalbomis (LT/UA/EN/…), su sudėtingu scoring’u ir versijavimu, duomenų ištrynimu savitarnoje, audit įvykių registracija be PII, ir patikimu backup’u į R2.

- 