#!/bin/bash

# AI.duino Locale Keys Update Script
# Adds missing promptEditor and buttons keys to all locale files

# Define all target languages
LANGUAGES=(bg bs cs da el en es et fi fr hr hu it ja ko lt lv mk nl no pl pt ro sk sl sq sr sv tr uk zh)

# Define the locales directory (adjust path if needed)
LOCALES_DIR="./locales"

# Check if locales directory exists
if [ ! -d "$LOCALES_DIR" ]; then
    echo "Error: Locales directory not found at $LOCALES_DIR"
    echo "Please adjust LOCALES_DIR in the script or run from correct directory"
    exit 1
fi

echo "Updating locale files with missing promptEditor and buttons keys..."
echo "Target languages: ${LANGUAGES[@]}"
echo ""

# Function to add keys to a JSON file
update_locale_file() {
    local lang=$1
    local file="$LOCALES_DIR/${lang}.json"
    
    echo "Processing: $lang.json"
    
    # Check if file exists
    if [ ! -f "$file" ]; then
        echo "  Warning: $file not found, skipping..."
        return
    fi
    
    # Create backup
    cp "$file" "${file}.backup"
    
    # Use Python to properly update JSON (preserves formatting)
    python3 << EOF
import json
import sys

# Translations for each language
translations = {
    'bg': {
        'buttons': {
            'saveChanges': 'Запази промените',
            'discard': 'Отхвърли', 
            'closeWithoutSaving': 'Затвори без запазване'
        },
        'promptEditor': {
            'changesLostDialog': 'Панелът беше затворен с незапазени промени. Какво искате да направите?',
            'changesSaved': 'Промените са запазени!'
        }
    },
    'bs': {
        'buttons': {
            'saveChanges': 'Sačuvaj izmjene',
            'discard': 'Odbaci',
            'closeWithoutSaving': 'Zatvori bez čuvanja'
        },
        'promptEditor': {
            'changesLostDialog': 'Panel je zatvoren sa nesačuvanim izmjenama. Šta želite da radite?',
            'changesSaved': 'Izmjene su sačuvane!'
        }
    },
    'cs': {
        'buttons': {
            'saveChanges': 'Uložit změny',
            'discard': 'Zahodit',
            'closeWithoutSaving': 'Zavřít bez uložení'
        },
        'promptEditor': {
            'changesLostDialog': 'Panel byl zavřen s neuloženými změnami. Co chcete udělat?',
            'changesSaved': 'Změny byly uloženy!'
        }
    },
    'da': {
        'buttons': {
            'saveChanges': 'Gem ændringer',
            'discard': 'Kassér',
            'closeWithoutSaving': 'Luk uden at gemme'
        },
        'promptEditor': {
            'changesLostDialog': 'Panelet blev lukket med ikke-gemte ændringer. Hvad vil du gøre?',
            'changesSaved': 'Ændringer gemt!'
        }
    },
    'el': {
        'buttons': {
            'saveChanges': 'Αποθήκευση αλλαγών',
            'discard': 'Απόρριψη',
            'closeWithoutSaving': 'Κλείσιμο χωρίς αποθήκευση'
        },
        'promptEditor': {
            'changesLostDialog': 'Ο πίνακας έκλεισε με μη αποθηκευμένες αλλαγές. Τι θέλετε να κάνετε;',
            'changesSaved': 'Οι αλλαγές αποθηκεύτηκαν!'
        }
    },
    'en': {
        'buttons': {
            'saveChanges': 'Save Changes',
            'discard': 'Discard',
            'closeWithoutSaving': 'Close without Saving'
        },
        'promptEditor': {
            'changesLostDialog': 'The panel was closed with unsaved changes. What would you like to do?',
            'changesSaved': 'Changes saved!'
        }
    },
    'es': {
        'buttons': {
            'saveChanges': 'Guardar cambios',
            'discard': 'Descartar',
            'closeWithoutSaving': 'Cerrar sin guardar'
        },
        'promptEditor': {
            'changesLostDialog': 'El panel se cerró con cambios no guardados. ¿Qué te gustaría hacer?',
            'changesSaved': '¡Cambios guardados!'
        }
    },
    'et': {
        'buttons': {
            'saveChanges': 'Salvesta muudatused',
            'discard': 'Loobu',
            'closeWithoutSaving': 'Sulge salvestamata'
        },
        'promptEditor': {
            'changesLostDialog': 'Paneel suleti salvestamata muudatustega. Mida soovite teha?',
            'changesSaved': 'Muudatused salvestatud!'
        }
    },
    'fi': {
        'buttons': {
            'saveChanges': 'Tallenna muutokset',
            'discard': 'Hylkää',
            'closeWithoutSaving': 'Sulje tallentamatta'
        },
        'promptEditor': {
            'changesLostDialog': 'Paneeli suljettiin tallentamattomien muutosten kanssa. Mitä haluat tehdä?',
            'changesSaved': 'Muutokset tallennettu!'
        }
    },
    'fr': {
        'buttons': {
            'saveChanges': 'Enregistrer les modifications',
            'discard': 'Annuler',
            'closeWithoutSaving': 'Fermer sans enregistrer'
        },
        'promptEditor': {
            'changesLostDialog': 'Le panneau a été fermé avec des modifications non enregistrées. Que voulez-vous faire ?',
            'changesSaved': 'Modifications enregistrées !'
        }
    },
    'hr': {
        'buttons': {
            'saveChanges': 'Spremi promjene',
            'discard': 'Odbaci',
            'closeWithoutSaving': 'Zatvori bez spremanja'
        },
        'promptEditor': {
            'changesLostDialog': 'Panel je zatvoren s nespremljenim promjenama. Što želite učiniti?',
            'changesSaved': 'Promjene su spremljene!'
        }
    },
    'hu': {
        'buttons': {
            'saveChanges': 'Változások mentése',
            'discard': 'Elvetés',
            'closeWithoutSaving': 'Bezárás mentés nélkül'
        },
        'promptEditor': {
            'changesLostDialog': 'A panel nem mentett változtatásokkal lett bezárva. Mit szeretne tenni?',
            'changesSaved': 'Változások mentve!'
        }
    },
    'it': {
        'buttons': {
            'saveChanges': 'Salva modifiche',
            'discard': 'Scarta',
            'closeWithoutSaving': 'Chiudi senza salvare'
        },
        'promptEditor': {
            'changesLostDialog': 'Il pannello è stato chiuso con modifiche non salvate. Cosa vorresti fare?',
            'changesSaved': 'Modifiche salvate!'
        }
    },
    'ja': {
        'buttons': {
            'saveChanges': '変更を保存',
            'discard': '破棄',
            'closeWithoutSaving': '保存せずに閉じる'
        },
        'promptEditor': {
            'changesLostDialog': 'パネルが未保存の変更と共に閉じられました。どうしますか？',
            'changesSaved': '変更が保存されました！'
        }
    },
    'ko': {
        'buttons': {
            'saveChanges': '변경사항 저장',
            'discard': '취소',
            'closeWithoutSaving': '저장하지 않고 닫기'
        },
        'promptEditor': {
            'changesLostDialog': '패널이 저장되지 않은 변경사항과 함께 닫혔습니다. 어떻게 하시겠습니까?',
            'changesSaved': '변경사항이 저장되었습니다!'
        }
    },
    'lt': {
        'buttons': {
            'saveChanges': 'Išsaugoti pakeitimus',
            'discard': 'Atšaukti',
            'closeWithoutSaving': 'Uždaryti neišsaugant'
        },
        'promptEditor': {
            'changesLostDialog': 'Skydelis buvo uždarytas su neišsaugotais pakeitimais. Ką norėtumėte daryti?',
            'changesSaved': 'Pakeitimai išsaugoti!'
        }
    },
    'lv': {
        'buttons': {
            'saveChanges': 'Saglabāt izmaiņas',
            'discard': 'Atmest',
            'closeWithoutSaving': 'Aizvērt nesaglabājot'
        },
        'promptEditor': {
            'changesLostDialog': 'Panelis tika aizvērts ar nesaglabātām izmaiņām. Ko vēlaties darīt?',
            'changesSaved': 'Izmaiņas saglabātas!'
        }
    },
    'mk': {
        'buttons': {
            'saveChanges': 'Зачувај промени',
            'discard': 'Отфрли',
            'closeWithoutSaving': 'Затвори без зачувување'
        },
        'promptEditor': {
            'changesLostDialog': 'Панелот беше затворен со незачувани промени. Што сакате да направите?',
            'changesSaved': 'Промените се зачувани!'
        }
    },
    'nl': {
        'buttons': {
            'saveChanges': 'Wijzigingen opslaan',
            'discard': 'Verwerpen',
            'closeWithoutSaving': 'Sluiten zonder opslaan'
        },
        'promptEditor': {
            'changesLostDialog': 'Het paneel werd gesloten met niet-opgeslagen wijzigingen. Wat wilt u doen?',
            'changesSaved': 'Wijzigingen opgeslagen!'
        }
    },
    'no': {
        'buttons': {
            'saveChanges': 'Lagre endringer',
            'discard': 'Forkast',
            'closeWithoutSaving': 'Lukk uten å lagre'
        },
        'promptEditor': {
            'changesLostDialog': 'Panelet ble lukket med ulagrede endringer. Hva vil du gjøre?',
            'changesSaved': 'Endringer lagret!'
        }
    },
    'pl': {
        'buttons': {
            'saveChanges': 'Zapisz zmiany',
            'discard': 'Odrzuć',
            'closeWithoutSaving': 'Zamknij bez zapisywania'
        },
        'promptEditor': {
            'changesLostDialog': 'Panel został zamknięty z niezapisanymi zmianami. Co chcesz zrobić?',
            'changesSaved': 'Zmiany zapisane!'
        }
    },
    'pt': {
        'buttons': {
            'saveChanges': 'Salvar alterações',
            'discard': 'Descartar',
            'closeWithoutSaving': 'Fechar sem salvar'
        },
        'promptEditor': {
            'changesLostDialog': 'O painel foi fechado com alterações não salvas. O que você gostaria de fazer?',
            'changesSaved': 'Alterações salvas!'
        }
    },
    'ro': {
        'buttons': {
            'saveChanges': 'Salvează modificările',
            'discard': 'Renunță',
            'closeWithoutSaving': 'Închide fără salvare'
        },
        'promptEditor': {
            'changesLostDialog': 'Panoul a fost închis cu modificări nesalvate. Ce doriți să faceți?',
            'changesSaved': 'Modificări salvate!'
        }
    },
    'sk': {
        'buttons': {
            'saveChanges': 'Uložiť zmeny',
            'discard': 'Zahodiť',
            'closeWithoutSaving': 'Zavrieť bez uloženia'
        },
        'promptEditor': {
            'changesLostDialog': 'Panel bol zatvorený s neuloženými zmenami. Čo chcete urobiť?',
            'changesSaved': 'Zmeny uložené!'
        }
    },
    'sl': {
        'buttons': {
            'saveChanges': 'Shrani spremembe',
            'discard': 'Zavrzi',
            'closeWithoutSaving': 'Zapri brez shranjevanja'
        },
        'promptEditor': {
            'changesLostDialog': 'Plošča je bila zaprta z nesehranjenimi spremembami. Kaj bi radi naredili?',
            'changesSaved': 'Spremembe shranjene!'
        }
    },
    'sq': {
        'buttons': {
            'saveChanges': 'Ruaj ndryshimet',
            'discard': 'Hidh',
            'closeWithoutSaving': 'Mbyll pa ruajtur'
        },
        'promptEditor': {
            'changesLostDialog': 'Paneli u mbyll me ndryshime të paruajtura. Çfarë dëshironi të bëni?',
            'changesSaved': 'Ndryshimet u ruajtën!'
        }
    },
    'sr': {
        'buttons': {
            'saveChanges': 'Сачувај измене',
            'discard': 'Одбаци',
            'closeWithoutSaving': 'Затвори без чувања'
        },
        'promptEditor': {
            'changesLostDialog': 'Панел је затворен са несачуваним изменама. Шта желите да радите?',
            'changesSaved': 'Измене су сачуване!'
        }
    },
    'sv': {
        'buttons': {
            'saveChanges': 'Spara ändringar',
            'discard': 'Förkasta',
            'closeWithoutSaving': 'Stäng utan att spara'
        },
        'promptEditor': {
            'changesLostDialog': 'Panelen stängdes med osparade ändringar. Vad vill du göra?',
            'changesSaved': 'Ändringar sparade!'
        }
    },
    'tr': {
        'buttons': {
            'saveChanges': 'Değişiklikleri kaydet',
            'discard': 'İptal et',
            'closeWithoutSaving': 'Kaydetmeden kapat'
        },
        'promptEditor': {
            'changesLostDialog': 'Panel kaydedilmemiş değişikliklerle kapatıldı. Ne yapmak istiyorsunuz?',
            'changesSaved': 'Değişiklikler kaydedildi!'
        }
    },
    'uk': {
        'buttons': {
            'saveChanges': 'Зберегти зміни',
            'discard': 'Скасувати',
            'closeWithoutSaving': 'Закрити без збереження'
        },
        'promptEditor': {
            'changesLostDialog': 'Панель була закрита з незбереженими змінами. Що ви хочете зробити?',
            'changesSaved': 'Зміни збережено!'
        }
    },
    'zh': {
        'buttons': {
            'saveChanges': '保存更改',
            'discard': '放弃',
            'closeWithoutSaving': '不保存关闭'
        },
        'promptEditor': {
            'changesLostDialog': '面板关闭时有未保存的更改。您想要做什么？',
            'changesSaved': '更改已保存！'
        }
    }
}

try:
    with open('$file', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Get translations for current language
    lang = '$lang'
    if lang not in translations:
        print(f"  Warning: No translations for {lang}")
        sys.exit(0)
    
    # Add missing keys to buttons section
    if 'buttons' not in data:
        data['buttons'] = {}
    
    for key, value in translations[lang]['buttons'].items():
        if key not in data['buttons']:
            data['buttons'][key] = value
            print(f"    Added buttons.{key}")
    
    # Add missing keys to promptEditor section
    if 'promptEditor' not in data:
        data['promptEditor'] = {}
    
    for key, value in translations[lang]['promptEditor'].items():
        if key not in data['promptEditor']:
            data['promptEditor'][key] = value
            print(f"    Added promptEditor.{key}")
    
    # Write back with proper formatting
    with open('$file', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"  Success: Updated {lang}.json")

except Exception as e:
    print(f"  Error: Failed to update {lang}.json - {str(e)}")
    sys.exit(1)
EOF
    
    if [ $? -eq 0 ]; then
        # Remove backup if successful
        rm "${file}.backup"
    else
        # Restore backup if failed
        echo "  Error occurred, restoring backup..."
        mv "${file}.backup" "$file"
    fi
    
    echo ""
}

# Process each language
for lang in "${LANGUAGES[@]}"; do
    update_locale_file "$lang"
done

echo "✅ Locale update completed!"
echo "All files have been updated with missing promptEditor and buttons keys."
echo ""
echo "Summary:"
echo "- changesLostDialog and changesSaved added to promptEditor section"
echo "- saveChanges, discard, and closeWithoutSaving added to buttons section"
echo "- Proper JSON formatting preserved"
echo "- Backups created and removed on success"
