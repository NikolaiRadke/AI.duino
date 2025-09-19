#!/bin/bash

# AI.duino Locale Updater Script v2
# Ersetzt placeholderWarning und fügt missingPlaceholderMultiple hinzu

# Array mit allen Locales (außer de.json)
LOCALES=(bg bs cs da el en es et fi fr ht hu it ja ko lt lv mk nl no pl pt ro sk sl sq sr sv tr uk zh)

# Neue placeholderWarning Übersetzungen (mit {0}, {1}, {2})
declare -A NEW_PLACEHOLDER_WARNING
NEW_PLACEHOLDER_WARNING[bg]="Важно: Не изтривайте заместителите {0}, {1}, {2} - те се заменят с код и инструкции!"
NEW_PLACEHOLDER_WARNING[bs]="Važno: Ne brišite čuvare mesta {0}, {1}, {2} - zamenjuju se kodom i instrukcijama!"
NEW_PLACEHOLDER_WARNING[cs]="Důležité: Nemazejte zástupné symboly {0}, {1}, {2} - nahrazují se kódem a pokyny!"
NEW_PLACEHOLDER_WARNING[da]="Vigtigt: Slet ikke pladsholdere {0}, {1}, {2} - de erstattes med kode og instruktioner!"
NEW_PLACEHOLDER_WARNING[el]="Σημαντικό: Μην διαγράψετε τους κράτες θέσης {0}, {1}, {2} - αντικαθίστανται με κώδικα και οδηγίες!"
NEW_PLACEHOLDER_WARNING[en]="Important: Do not delete placeholders {0}, {1}, {2} - they get replaced with code and instructions!"
NEW_PLACEHOLDER_WARNING[es]="Importante: No eliminar los marcadores {0}, {1}, {2} - se reemplazan con código e instrucciones!"
NEW_PLACEHOLDER_WARNING[et]="Oluline: Ärge kustutage kohatäitjaid {0}, {1}, {2} - need asendatakse koodi ja juhenditega!"
NEW_PLACEHOLDER_WARNING[fi]="Tärkeää: Älä poista paikkamerkkejä {0}, {1}, {2} - ne korvataan koodilla ja ohjeilla!"
NEW_PLACEHOLDER_WARNING[fr]="Important: Ne pas supprimer les espaces réservés {0}, {1}, {2} - ils sont remplacés par du code et des instructions!"
NEW_PLACEHOLDER_WARNING[ht]="Enpòtan: Pa efase placeholder yo {0}, {1}, {2} - yo ranplase ak kòd ak enstriksyon yo!"
NEW_PLACEHOLDER_WARNING[hu]="Fontos: Ne törölje a helyőrzőket {0}, {1}, {2} - kóddal és utasításokkal helyettesítődnek!"
NEW_PLACEHOLDER_WARNING[it]="Importante: Non eliminare i segnaposto {0}, {1}, {2} - vengono sostituiti con codice e istruzioni!"
NEW_PLACEHOLDER_WARNING[ja]="重要：プレースホルダー {0}, {1}, {2} を削除しないでください - コードと指示に置き換えられます！"
NEW_PLACEHOLDER_WARNING[ko]="중요: 자리 표시자 {0}, {1}, {2}를 삭제하지 마세요 - 코드와 지침으로 대체됩니다!"
NEW_PLACEHOLDER_WARNING[lt]="Svarbu: Neištrinkite vietos žymeklių {0}, {1}, {2} - jie pakeičiami kodu ir instrukcijomis!"
NEW_PLACEHOLDER_WARNING[lv]="Svarīgi: Neizdzēsiet vietturus {0}, {1}, {2} - tie tiek aizstāti ar kodu un instrukcijām!"
NEW_PLACEHOLDER_WARNING[mk]="Важно: Не ги бришете местодржачите {0}, {1}, {2} - се заменуваат со код и инструкции!"
NEW_PLACEHOLDER_WARNING[nl]="Belangrijk: Verwijder placeholders {0}, {1}, {2} niet - deze worden vervangen door code en instructies!"
NEW_PLACEHOLDER_WARNING[no]="Viktig: Ikke slett plassholdere {0}, {1}, {2} - de erstattes med kode og instruksjoner!"
NEW_PLACEHOLDER_WARNING[pl]="Ważne: Nie usuwaj symboli zastępczych {0}, {1}, {2} - są zastępowane kodem i instrukcjami!"
NEW_PLACEHOLDER_WARNING[pt]="Importante: Não excluir os marcadores {0}, {1}, {2} - eles são substituídos por código e instruções!"
NEW_PLACEHOLDER_WARNING[ro]="Important: Nu ștergeți substituțiile {0}, {1}, {2} - sunt înlocuite cu cod și instrucțiuni!"
NEW_PLACEHOLDER_WARNING[sk]="Dôležité: Nemazajte zástupné symboly {0}, {1}, {2} - nahradia sa kódom a pokynmi!"
NEW_PLACEHOLDER_WARNING[sl]="Pomembno: Ne brišite oglate oklepaje {0}, {1}, {2} - nadomesti jih koda in navodila!"
NEW_PLACEHOLDER_WARNING[sq]="E rëndësishme: Mos i fshini vendmbajtësit {0}, {1}, {2} - ata zëvendësohen me kod dhe udhëzime!"
NEW_PLACEHOLDER_WARNING[sr]="Важно: Не бришите чуваре места {0}, {1}, {2} - замењују се кодом и инструкцијама!"
NEW_PLACEHOLDER_WARNING[sv]="Viktigt: Ta inte bort platshållarna {0}, {1}, {2} - de ersätts med kod och instruktioner!"
NEW_PLACEHOLDER_WARNING[tr]="Önemli: Yer tutucuları {0}, {1}, {2} silmeyin - kod ve talimatlarla değiştirilir!"
NEW_PLACEHOLDER_WARNING[uk]="Важливо: Не видаляйте заповнювачі {0}, {1}, {2} - вони замінюються кодом та інструкціями!"
NEW_PLACEHOLDER_WARNING[zh]="重要：不要删除占位符 {0}, {1}, {2} - 它们会被代码和指令替换！"

# missingPlaceholderMultiple Übersetzungen
declare -A MISSING_PLACEHOLDER_MULTIPLE
MISSING_PLACEHOLDER_MULTIPLE[bg]="Грешка: Липсва заместител {0}, {1} или {2}!"
MISSING_PLACEHOLDER_MULTIPLE[bs]="Greška: Nedostaje čuvar mesta {0}, {1} ili {2}!"
MISSING_PLACEHOLDER_MULTIPLE[cs]="Chyba: Chybí zástupný symbol {0}, {1} nebo {2}!"
MISSING_PLACEHOLDER_MULTIPLE[da]="Fejl: Manglende pladsholder {0}, {1} eller {2}!"
MISSING_PLACEHOLDER_MULTIPLE[el]="Σφάλμα: Λείπει ο κράτης θέσης {0}, {1} ή {2}!"
MISSING_PLACEHOLDER_MULTIPLE[en]="Error: Missing placeholder {0}, {1} or {2}!"
MISSING_PLACEHOLDER_MULTIPLE[es]="Error: Falta el marcador {0}, {1} o {2}!"
MISSING_PLACEHOLDER_MULTIPLE[et]="Viga: Puudub kohatäitja {0}, {1} või {2}!"
MISSING_PLACEHOLDER_MULTIPLE[fi]="Virhe: Paikkamerkki {0}, {1} tai {2} puuttuu!"
MISSING_PLACEHOLDER_MULTIPLE[fr]="Erreur: Espace réservé {0}, {1} ou {2} manquant!"
MISSING_PLACEHOLDER_MULTIPLE[ht]="Erè: Placeholder {0}, {1} oswa {2} ki manke!"
MISSING_PLACEHOLDER_MULTIPLE[hu]="Hiba: Hiányzó helyőrző {0}, {1} vagy {2}!"
MISSING_PLACEHOLDER_MULTIPLE[it]="Errore: Manca il segnaposto {0}, {1} o {2}!"
MISSING_PLACEHOLDER_MULTIPLE[ja]="エラー：プレースホルダー {0}、{1} または {2} がありません！"
MISSING_PLACEHOLDER_MULTIPLE[ko]="오류: 자리 표시자 {0}, {1} 또는 {2}가 누락되었습니다!"
MISSING_PLACEHOLDER_MULTIPLE[lt]="Klaida: Trūksta vietos žymeklio {0}, {1} arba {2}!"
MISSING_PLACEHOLDER_MULTIPLE[lv]="Kļūda: Trūkst vietturi {0}, {1} vai {2}!"
MISSING_PLACEHOLDER_MULTIPLE[mk]="Грешка: Недостасува местодржач {0}, {1} или {2}!"
MISSING_PLACEHOLDER_MULTIPLE[nl]="Fout: Ontbrekende placeholder {0}, {1} of {2}!"
MISSING_PLACEHOLDER_MULTIPLE[no]="Feil: Manglende plassholder {0}, {1} eller {2}!"
MISSING_PLACEHOLDER_MULTIPLE[pl]="Błąd: Brak symbolu zastępczego {0}, {1} lub {2}!"
MISSING_PLACEHOLDER_MULTIPLE[pt]="Erro: Marcador {0}, {1} ou {2} ausente!"
MISSING_PLACEHOLDER_MULTIPLE[ro]="Eroare: Lipsește substituția {0}, {1} sau {2}!"
MISSING_PLACEHOLDER_MULTIPLE[sk]="Chyba: Chýba zástupný symbol {0}, {1} alebo {2}!"
MISSING_PLACEHOLDER_MULTIPLE[sl]="Napaka: Manjka oglatih oklepajev {0}, {1} ali {2}!"
MISSING_PLACEHOLDER_MULTIPLE[sq]="Gabim: Mungon vendmbajtësi {0}, {1} ose {2}!"
MISSING_PLACEHOLDER_MULTIPLE[sr]="Грешка: Недостаје чувар места {0}, {1} или {2}!"
MISSING_PLACEHOLDER_MULTIPLE[sv]="Fel: Saknar platshållare {0}, {1} eller {2}!"
MISSING_PLACEHOLDER_MULTIPLE[tr]="Hata: Yer tutucu {0}, {1} veya {2} eksik!"
MISSING_PLACEHOLDER_MULTIPLE[uk]="Помилка: Відсутній заповнювач {0}, {1} або {2}!"
MISSING_PLACEHOLDER_MULTIPLE[zh]="错误：缺少占位符 {0}、{1} 或 {2}！"

# Funktion zum Aktualisieren der Einträge
update_locale() {
    local locale=$1
    local file="${locale}.json"
    
    if [[ ! -f "$file" ]]; then
        echo "Warnung: $file nicht gefunden, überspringe..."
        return
    fi
    
    echo "Bearbeite $file..."
    
    # Temporäre Datei erstellen
    temp_file=$(mktemp)
    
    # Datei zeilenweise verarbeiten
    while IFS= read -r line; do
        # placeholderWarning ersetzen
        if [[ $line =~ \"placeholderWarning\":[[:space:]]*\".*\" ]]; then
            echo "    \"placeholderWarning\": \"${NEW_PLACEHOLDER_WARNING[$locale]}\"," >> "$temp_file"
        # missingPlaceholder Zeile: missingPlaceholderMultiple danach einfügen
        elif [[ $line =~ \"missingPlaceholder\":[[:space:]]*\".*\" ]]; then
            echo "$line" >> "$temp_file"
            echo "    \"missingPlaceholderMultiple\": \"${MISSING_PLACEHOLDER_MULTIPLE[$locale]}\"," >> "$temp_file"
        else
            echo "$line" >> "$temp_file"
        fi
    done < "$file"
    
    # Originaldatei ersetzen
    mv "$temp_file" "$file"
    
    echo "✓ $file aktualisiert"
}

# Hauptausführung
echo "AI.duino Locale Updater v2"
echo "=========================="
echo "Aktualisiere placeholderWarning und füge missingPlaceholderMultiple hinzu..."
echo

# Prüfen ob wir im richtigen Verzeichnis sind
if [[ ! -f "de.json" ]]; then
    echo "Fehler: de.json nicht gefunden. Bitte im locales-Verzeichnis ausführen."
    exit 1
fi

echo "Bearbeitung startet..."
echo

# Alle Locales bearbeiten
for locale in "${LOCALES[@]}"; do
    if [[ -f "${locale}.json" ]]; then
        update_locale "$locale"
    else
        echo "Warnung: ${locale}.json nicht gefunden"
    fi
done

echo
echo "✓ Fertig! Alle Locale-Dateien wurden aktualisiert."
