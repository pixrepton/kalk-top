jQuery(document).ready(function($) {
    var currentKitPriceNetto = 0;
    var prices = (typeof topInstal !== 'undefined' && topInstal.prices) ? topInstal.prices : {};

    // Domyślna cena (zostanie nadpisana przez updateTotalPrice)
    $('#custom_price').val('41000');

    // Obsługa przełączania między sekcjami (Pompa ciepła / Podłogówka)
    $('input[name="installation_type"]').on('change', function() {
        const selectedType = $(this).val();
        const $heatPumpSection = $('#heat-pump-section');
        const $floorHeatingSection = $('#floor-heating-section');
        
        if (selectedType === 'heat_pump') {
            $heatPumpSection.show();
            $floorHeatingSection.hide();
        } else if (selectedType === 'floor_heating') {
            $heatPumpSection.hide();
            $floorHeatingSection.show();
        }
    });

    // Inicjalizacja
    handlePompaTypeChange();
    updateCWUControls();
    updateBufferControls();
    updateTankOptionsForPower();
    loadKitOptions();
    checkTankConfigPrice();
    updateTotalPrice();

    // Obsługa zmiany mocy
    $('input[name="power_kw"]').on('change', function () {
        updateTankOptionsForPower();
        loadKitOptions();
    });

    $('#tank_capacity').on('change', function(){
        const val = $(this).val();
        const $tankManufacturer = $('#tank-manufacturer-select');
        if (val === '185-aio' || val === '260-aio') {
            $tankManufacturer.val('').prop('disabled', true).addClass('dimmed');
        } else {
            if ($('#has_cwu').is(':checked')) {
                $tankManufacturer.prop('disabled', false).removeClass('dimmed');
            }
        }
        loadKitOptions();
        checkTankConfigPrice();
        updateTotalPrice();
    });

    $('#tank-manufacturer-select').on('change', function(){
        checkTankConfigPrice();
        updateTotalPrice();
    });

    // Przełącznik CWU
    $('#has_cwu').on('change', function(){
        updateCWUControls();
        updateTankOptionsForPower();
        loadKitOptions();
        checkTankConfigPrice();
        updateTotalPrice();
    });

    // Przełącznik Bufor
    $('#has_buffer').on('change', function(){
        updateBufferControls();
        updateTotalPrice();
    });

    $('#buffer_capacity').on('change', function(){
        updateTotalPrice();
    });

    // Obsługa automatycznego uzupełniania ceny przy zmianie zestawu
    $('#kit_model').on('change', function(){
        const selectedKit = $(this).val();
        if (selectedKit) {
            const powerKW = parseInt($('input[name="power_kw"]:checked').val(), 10);
            const hasCWU = $('#has_cwu').is(':checked');
            const tankCapacity = hasCWU ? $('#tank_capacity').val() : 'none';
            fetch(topInstal.ajaxurl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    action: 'get_kits',
                    nonce: topInstal.nonce,
                    power_type: 'all',
                    tank_capacity: tankCapacity,
                    power_kw: isNaN(powerKW) ? '' : powerKW
                })
            })
            .then(res => res.json())
            .then(response => {
                if (response.success && response.data && response.data[selectedKit]) {
                    currentKitPriceNetto = parseInt(response.data[selectedKit].price, 10) || 0;
                    updateTotalPrice();
                }
            })
            .catch(function() {
                currentKitPriceNetto = 0;
                updateTotalPrice();
            });
        } else {
            currentKitPriceNetto = 0;
            updateTotalPrice();
        }
    });

    // Suma: pompa (netto) + zbiornik CWU + bufor (sprzęgło) + installation_net + części hydrauliczne + fundament 300
    function updateTotalPrice() {
        var p = prices;
        var vatRate = (p.vat_rate != null) ? p.vat_rate : 0.08;

        var kitNetto = currentKitPriceNetto || 0;

        var tankNetto = 0;
        var hasCWU = $('#has_cwu').is(':checked');
        var capacity = $('#tank_capacity').val();
        var manufacturer = ($('#tank-manufacturer-select').val() || '').trim();
        if (hasCWU && capacity && capacity !== '185-aio' && capacity !== '260-aio' && p.cwu) {
            var tankType = null;
            if (['THERMATEC', 'VIQTIS', 'ECLIS Puretherm'].indexOf(manufacturer) !== -1) tankType = 'inox';
            if (['Trinnity', 'Galmet'].indexOf(manufacturer) !== -1) tankType = 'emalia';
            if (tankType && p.cwu[tankType] && p.cwu[tankType][capacity] != null) tankNetto = parseInt(p.cwu[tankType][capacity], 10) || 0;
        }

        var bufferNetto = 0;
        var hasBuffer = $('#has_buffer').is(':checked');
        if (hasBuffer && p.buffer) {
            var bufCap = $('#buffer_capacity').val();
            var bufKey = bufCap;
            var rangeToHigher = { '60-80': '80', '80-100': '100', '100-120': '120', '100-150': '150', '120-150': '150', '150-200': '200' };
            if (rangeToHigher[bufCap]) bufKey = rangeToHigher[bufCap];
            if (p.buffer[bufKey] && p.buffer[bufKey].sprzeglo != null) bufferNetto = parseInt(p.buffer[bufKey].sprzeglo, 10) || 0;
        }

        var installationNetto = parseInt(p.installation_net, 10);
        if (isNaN(installationNetto)) installationNetto = 11000;
        var kitId = $('#kit_model').val() || '';
        var isAio = /^KIT-(ADC|AXC)/i.test(kitId);
        var hydraulicNetto = isAio ? (parseInt(p.hydraulic_components_aio, 10)) : (parseInt(p.hydraulic_components_split, 10));
        if (isNaN(hydraulicNetto)) hydraulicNetto = isAio ? 2700 : 3700;
        var foundationNetto = 300;
        if (p.foundation && p.foundation['fundament-nasz'] != null) foundationNetto = parseInt(p.foundation['fundament-nasz'], 10) || 300;

        var totalNetto = kitNetto + tankNetto + bufferNetto + installationNetto + hydraulicNetto + foundationNetto;
        var totalBrutto = Math.round(totalNetto * (1 + vatRate));
        $('#custom_price').val(totalBrutto);
    }

    // Sprawdzenie, czy dla wybranej konfiguracji zbiornika (pojemność + producent) jest cena
    // Zgodne z prices.json: emalia 150,200,300; inox 150,200,250,300 (brak: emalia 250,400; inox 400)
    function checkTankConfigPrice() {
        const hasCWU = $('#has_cwu').is(':checked');
        const capacity = $('#tank_capacity').val();
        const manufacturer = ($('#tank-manufacturer-select').val() || '').trim();
        const $wrapper = $('#tank-config-wrapper');
        const $error = $('#tank-config-error');

        if (!hasCWU || capacity === '185-aio' || capacity === '260-aio') {
            $wrapper.removeClass('has-tank-config-error');
            $error.hide();
            return true;
        }
        if (!manufacturer || manufacturer === '') {
            $wrapper.removeClass('has-tank-config-error');
            $error.hide();
            return true;
        }

        var tankType = null;
        if (['THERMATEC', 'VIQTIS', 'ECLIS Puretherm'].indexOf(manufacturer) !== -1) tankType = 'inox';
        if (['Trinnity', 'Galmet'].indexOf(manufacturer) !== -1) tankType = 'emalia';
        if (!tankType) {
            $wrapper.removeClass('has-tank-config-error');
            $error.hide();
            return true;
        }

        var hasPrice = false;
        if (tankType === 'emalia' && { '150': 1, '200': 1, '300': 1 }[capacity]) hasPrice = true;
        if (tankType === 'inox'  && { '150': 1, '200': 1, '250': 1, '300': 1 }[capacity]) hasPrice = true;

        if (!hasPrice) {
            $wrapper.addClass('has-tank-config-error');
            $error.show();
            return false;
        }
        $wrapper.removeClass('has-tank-config-error');
        $error.hide();
        return true;
    }

    // Obsługa formularza
    $('#generatorForm').on('submit', function(e) {
        if (!checkTankConfigPrice()) {
            e.preventDefault();
            $('#tank-config-error')[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }
        e.preventDefault();

        const generateBtn = $('#generateBtn');
        const originalText = generateBtn.html();
        generateBtn.html('⏳ Generowanie...').prop('disabled', true);

        const formData = $(this).serializeArray();
        const data = {};
        $.each(formData, function(i, field) {
            data[field.name] = field.value;
        });
        // Zawsze jawnie ustaw format: gdy użytkownik wybrał "PDF" → konwerter DOCX→PDF na serwerze
        data.output_format = ($('input[name="output_format"]:checked').val() || 'docx');
        
        // Ustal CWU na podstawie checkboxa
        const hasCWU = $('#has_cwu').is(':checked');
        data.has_cwu = hasCWU ? '1' : '0';
        if (!hasCWU) {
            data.tank_capacity = 'none';
            data.tank_manufacturer = '';
        }

        // Ustal bufor na podstawie checkboxa
        const hasBuffer = $('#has_buffer').is(':checked');
        data.has_buffer = hasBuffer ? '1' : '0';
        if (!hasBuffer) {
            data.buffer_capacity = 'none';
        } else {
            data.buffer_capacity = $('#buffer_capacity').val();
        }

        // Debug - sprawdź czy buffer_capacity jest w formData
        console.log('🔍 DEBUG - formData:', formData);
        console.log('🔍 DEBUG - data object:', data);
        if (data.buffer_capacity) {
            console.log('✅ buffer_capacity znaleziony:', data.buffer_capacity);
        } else {
            console.log('❌ buffer_capacity NIE znaleziony w formData!');
        }

        fetch(topInstal.ajaxurl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'simple_generate',
                nonce: topInstal.nonce,
                data: JSON.stringify(data)
            })
        })
        .then(res => res.json())
        .then(response => {
            generateBtn.html(originalText).prop('disabled', false);

            if (response.success) {
                $('#resultText').text('Oferta została wygenerowana: ' + response.data.filename);
                $('#downloadLink').attr('href', response.data.download_url);
                
                // Wyświetl dodatkowe informacje o dokumencie
                if (response.data.template_used) {
                    $('#templateInfo').text('Szablon: ' + response.data.template_used);
                }
                if (response.data.placeholders_replaced) {
                    $('#placeholdersInfo').text('Zastąpionych placeholderów: ' + response.data.placeholders_replaced);
                }
                
                $('#results').show();
                $('#error').hide();
            } else {
                const errorPayload = response.data || {};
                const errorMessage =
                    (typeof errorPayload === 'string' && errorPayload) ||
                    errorPayload.message ||
                    (errorPayload.errorCode ? ('[' + errorPayload.errorCode + ']') : '') ||
                    'Nieznany blad';
                $('#errorText').text(errorMessage);
                $('#error').show();
                $('#results').hide();
            }
        })
        .catch(err => {
            generateBtn.html(originalText).prop('disabled', false);
            $('#errorText').text('Błąd sieci: ' + err.message);
            $('#error').show();
            $('#results').hide();
        });
    });

    // Logika zależności od wyboru typu pompy
    function handlePompaTypeChange() {}

    function updateCWUControls(){
        const hasCWU = $('#has_cwu').is(':checked');
        const $tankCapacity = $('#tank_capacity');
        const $tankManufacturer = $('#tank-manufacturer-select');
        if (hasCWU) {
            $tankCapacity.prop('disabled', false);
            $tankManufacturer.prop('disabled', false).removeClass('dimmed');
        } else {
            $tankCapacity.prop('disabled', true);
            // Zostaw producenta widocznego, ale nieaktywnego i „zaciemnionego”
            $tankManufacturer.val('').prop('disabled', true).addClass('dimmed');
        }
    }

    function updateBufferControls(){
        const hasBuffer = $('#has_buffer').is(':checked');
        const $bufferCapacity = $('#buffer_capacity');
        if (hasBuffer) {
            $bufferCapacity.prop('disabled', false);
        } else {
            $bufferCapacity.prop('disabled', true);
        }
    }

    // Inteligentne filtrowanie opcji pojemności CWU względem wybranej mocy
    function updateTankOptionsForPower(){
        const hasCWU = $('#has_cwu').is(':checked');
        const powerKW = parseInt($('input[name="power_kw"]:checked').val(), 10);
        const $tankCapacity = $('#tank_capacity');
        if (!hasCWU) {
            return; // gdy CWU wyłączone, nie przefiltrujemy listy (i tak disabled)
        }

        const isLowPower = [3,5,7].indexOf(powerKW) !== -1;
        // Dla mocy 3/5/7 ukryj AIO 260 i T-CAP 260 (brak sensownych zestawów dla tych mocy)
        const disallowSet = new Set(isLowPower ? ['260-aio','260-tcap'] : []);

        // Przejdź po opcjach i włącz/wyłącz
        let hasSelectedValid = true;
        const currentVal = $tankCapacity.val();
        $tankCapacity.find('option').each(function(){
            const val = $(this).val();
            const disallowed = disallowSet.has(val);
            $(this).prop('disabled', disallowed);
            // Ukryj w dropdownie opcje bezsensowne, by nie kusiły do wyboru
            if (disallowed) {
                $(this).attr('hidden', 'hidden');
            } else {
                $(this).removeAttr('hidden');
            }
        });

        // Jeśli aktualny wybór jest niedozwolony – ustaw pierwszy dostępny
        if (disallowSet.has(currentVal)) {
            const $firstAllowed = $tankCapacity.find('option:not([disabled])').first();
            if ($firstAllowed.length) {
                $tankCapacity.val($firstAllowed.val());
            }
        }
    }

    // Ładowanie zestawów pomp z serwera
    function loadKitOptions() {
        const powerKW = parseInt($('input[name="power_kw"]:checked').val(), 10);
        const hasCWU = $('#has_cwu').is(':checked');
        const tankCapacity = hasCWU ? $('#tank_capacity').val() : 'none';
        updateBufferControls();
        const kitSelect = $('#kit_model');
        const loading = $('#kit-loading');

        // Szerszy wybór: najpierw przefiltrujemy pojemność (AIO vs split) po stronie PHP, a tutaj dodamy filtr po mocy

        kitSelect.empty().append('<option value="">Ładowanie...</option>');
        loading.show();

        fetch(topInstal.ajaxurl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'get_kits',
                nonce: topInstal.nonce,
                power_type: 'all',
                tank_capacity: tankCapacity,
                power_kw: isNaN(powerKW) ? '' : powerKW
            })
        })
        .then(res => res.json())
        .then(response => {
            loading.hide();
            kitSelect.empty();

            if (response.success && response.data) {
                kitSelect.append('<option value="">Wybierz zestaw...</option>');
                const entries = Object.entries(response.data).filter(([key, kit])=>{
                    const m = /([0-9]+)kW/i.exec(kit.power||'');
                    const kw = m ? parseInt(m[1],10) : NaN;
                    return isNaN(powerKW) || isNaN(kw) || kw === powerKW;
                });
                for (const [key, kit] of entries) {
                    kitSelect.append(`<option value="${key}">${key} (${kit.power}, ${kit.voltage})</option>`);
                }
            } else {
                kitSelect.append('<option value="">Brak dostępnych zestawów</option>');
            }
        })
        .catch(() => {
            loading.hide();
            kitSelect.empty().append('<option value="">Błąd ładowania zestawów</option>');
        });
    }
});
