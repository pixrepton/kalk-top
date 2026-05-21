/**
 * pdfGenerator.js – Minimalistyczny raport cieplny budynku
 * Generuje techniczny dokument PDF z danymi z formularza i wyników obliczeń
 */

/** Czeka na załadowanie wszystkich img w kontenerze (zapobiega pustym obrazkom w html2canvas). */
function waitForImages(container) {
  const imgs = container.querySelectorAll("img");
  return Promise.all(
    [...imgs].map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((res) => {
              img.onload = res;
              img.onerror = res;
            })
    )
  );
}

/** Reset layout killers dla html2canvas (position fixed/sticky, overflow hidden, transform, height:100%). */
function normalizePdfContainer(container) {
  container.style.overflow = "visible";
  container.style.position = "absolute";

  const all = container.querySelectorAll("*");
  all.forEach((el) => {
    const s = el.style;
    const cs = window.getComputedStyle(el);
    if (cs.position === "fixed" || cs.position === "sticky") s.position = "static";
    if (cs.overflow === "hidden" || cs.overflow === "scroll") s.overflow = "visible";
    if (cs.transform && cs.transform !== "none") s.transform = "none";
    if (s.height === "100%" || (cs.height && cs.height.endsWith("100%"))) s.height = "auto";
  });

  container.querySelectorAll('[style*="position:fixed"], [style*="position:sticky"], [style*="position: sticky"]').forEach((el) => {
    el.style.position = "static";
  });
  container.querySelectorAll('[style*="height: 100%"]').forEach((el) => {
    el.style.height = "auto";
  });

  const sections = container.querySelectorAll("section, .pdf-section");
  sections.forEach((el, i) => {
    if (i > 0) el.classList.add("pdf-page-break");
  });
}

function resolvePdfMode(options = {}) {
  return options && options.mode === "energy" ? "energy" : "offer";
}

function resolvePdfFilename(mode) {
  const datePart = new Date().toISOString().split("T")[0];
  if (mode === "energy") {
    return `Raport_Cieplny_Budynku_${datePart}.pdf`;
  }
  return `Oferta_TOP-INSTAL_${datePart}.pdf`;
}

function sanitizePdfTextEncoding(input) {
  if (typeof input !== "string" || input.length === 0) {
    return input;
  }

  const replacements = [
    [/\u0139\u201A/g, "\u0142"], // mojibake ł -> ł
    [/\u0139\u0081/g, "\u0141"], // mojibake Ł -> Ł
    [/\u0139\u013D/g, "\u017C"], // mojibake ż -> ż
    [/\u0139\u017B/g, "\u017B"], // mojibake Ż -> Ż
    [/\u0139\u017A/g, "\u017A"], // mojibake ź -> ź
    [/\u0139\u0179/g, "\u0179"], // mojibake Ź -> Ź
    [/\u00C4\u2026/g, "\u0105"], // mojibake ą -> ą
    [/\u00C4\u2122/g, "\u0119"], // mojibake ę -> ę
    [/\u00C4\u2020/g, "\u0106"], // mojibake Ć -> Ć
    [/\u00C4\u2021/g, "\u0107"], // mojibake ć -> ć
    [/\u00C4\u0098/g, "\u0118"], // mojibake Ę -> Ę
    [/\u0139\u0161/g, "\u015A"], // mojibake Ś -> Ś
    [/\u0139\u203A/g, "\u015B"], // mojibake ś -> ś
    [/\u0103\u201A/g, "\u00F3"], // mojibake ó -> ó
    [/\u0102\u201C/g, "\u00D3"], // mojibake Ó -> Ó
    [/\u00C2\u00B0/g, "\u00B0"], // Â° -> °
    [/\u00C2\u02DB/g, "\u00B2"], // Â˛ -> ²
    [/\u0102\u2014/g, "\u00D7"], // mojibake × -> ×
    [/\u00E2\u20AC\u201D/g, "-"], // — -> -
    [/\u00E2\u20AC\u201C/g, "-"], // – -> -
    [/\u00E2\u20AC\u00A2/g, "\u2022"], // mojibake bullet -> •
  ];

  return replacements.reduce((acc, [pattern, next]) => acc.replace(pattern, next), input);
}

async function generatePdf(configData, options = {}) {
  let tempContainer = null;
  try {
    const mode = resolvePdfMode(options);
    const filename = resolvePdfFilename(mode);

    if (!configData || typeof configData !== "object") {
      throw new Error("generatePdf: configData is required and must be an object");
    }

    if (
      typeof window !== "undefined" &&
      typeof window.loadPdfLibraries === "function"
    ) {
      try {
        await window.loadPdfLibraries();
      } catch (err) {
        throw new Error(
          "Nie udalo sie zaladowac bibliotek PDF: " + err.message
        );
      }
    } else if (
      typeof html2canvas === "undefined" ||
      (typeof window.jsPDF === "undefined" &&
        !(window.jspdf && window.jspdf.jsPDF))
    ) {
      throw new Error(
        "Biblioteki PDF nie sa zaladowane. Uzyj loadPdfLibraries() z downloadPDF.js."
      );
    }

    const htmlContent = createPdfPagesMarkup(configData, { mode });
    if (!htmlContent || htmlContent.trim().length === 0) {
      throw new Error("Nie udalo sie wygenerowac zawartosci HTML dla PDF");
    }

    tempContainer = document.createElement("div");
    tempContainer.innerHTML = htmlContent;
    tempContainer.style.position = "absolute";
    tempContainer.style.left = "-10000px";
    tempContainer.style.top = "0";
    tempContainer.style.width = "794px";
    tempContainer.style.background = "#fff";
    tempContainer.style.fontFamily =
      "'DejaVu Sans', 'Noto Sans', Arial, Helvetica, sans-serif";
    tempContainer.style.margin = "0";
    tempContainer.style.padding = "0";
    tempContainer.style.border = "0";
    document.body.appendChild(tempContainer);

    normalizePdfContainer(tempContainer);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await waitForImages(tempContainer);
    await new Promise((resolve) =>
      requestAnimationFrame(() => setTimeout(resolve, 300))
    );

    const pageNodes = Array.from(
      tempContainer.querySelectorAll("[data-pdf-page]")
    );
    if (!pageNodes.length) {
      throw new Error("Brak zrenderowanych stron PDF.");
    }

    const jsPDFCtor =
      window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : window.jsPDF;
    if (!jsPDFCtor) {
      throw new Error("Brak konstruktora jsPDF w globalnym scope");
    }

    const pdf = new jsPDFCtor("p", "mm", "a4");
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    for (let index = 0; index < pageNodes.length; index += 1) {
      const pageNode = pageNodes[index];
      const canvas = await html2canvas(pageNode, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: pageNode.scrollWidth || 794,
        windowHeight: pageNode.scrollHeight || 1123,
      }).catch((error) => {
        throw new Error(`Blad konwersji strony PDF do Canvas: ${error.message}`);
      });

      if (index > 0) {
        pdf.addPage();
      }

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH, undefined, "FAST");
    }

    pdf.save(filename);
  } catch (err) {
    console.error("Blad podczas generowania PDF:", err);
    console.error("Szczegoly bledu:", err.stack);

    if (typeof ErrorHandler !== "undefined" && ErrorHandler.showToast) {
      ErrorHandler.showToast(
        err.message || "Nie udalo sie wygenerowac raportu PDF",
        "error",
        5000
      );
    } else {
      alert(
        "Nie udalo sie wygenerowac raportu PDF: " +
          (err.message || "Nieznany blad")
      );
    }

    throw err;
  } finally {
    if (tempContainer && document.body.contains(tempContainer)) {
      try {
        document.body.removeChild(tempContainer);
      } catch (cleanupError) {
        console.warn("[PDF] Blad podczas usuwania tempContainer:", cleanupError);
      }
    }
  }
}

function escapePdfHtml(value) {
  return sanitizePdfTextEncoding(String(value == null ? "" : value))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPdfMetric(value, unit = "", digits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "nie dotyczy";
  }
  const rounded =
    digits === 0 ? Math.round(numeric) : Number(numeric.toFixed(digits));
  const label = rounded.toLocaleString("pl-PL", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : digits,
    maximumFractionDigits: digits,
  });
  let displayUnit = unit;
  if (unit === "degC") displayUnit = "\u00B0C";
  if (unit === "m2") displayUnit = "m\u00B2";
  return displayUnit ? `${label} ${displayUnit}` : label;
}

function formatPdfCurrency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "nie dotyczy";
  }
  return `${Math.round(numeric).toLocaleString("pl-PL")} z\u0142`;
}

function buildPdfCostAssumptionsLine(assumptions) {
  if (!assumptions || typeof assumptions !== "object") {
    return "";
  }

  const parts = [];
  const pushMoney = (label, value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const decimals = numeric >= 1 ? 2 : 3;
    const rounded = Number(numeric.toFixed(decimals));
    const formatted = rounded.toLocaleString("pl-PL", {
      minimumFractionDigits: Number.isInteger(rounded) ? 0 : decimals,
      maximumFractionDigits: decimals,
    });
    parts.push(`${label} ${formatted} z\u0142/kWh`);
  };

  pushMoney("Pr\u0105d", assumptions.electricityPLNperKWh);
  pushMoney("Gaz", assumptions.gasPLNperKWh);
  pushMoney("Pellet", assumptions.pelletPLNperKWh);
  pushMoney("Drewno", assumptions.woodPLNperKWh);
  pushMoney("W\u0119giel", assumptions.coalPLNperKWh);

  if (Number.isFinite(Number(assumptions.scopUsed))) {
    parts.push(`SCOP ${formatPdfMetric(assumptions.scopUsed, "", 1)}`);
  }
  if (typeof assumptions.dateStamp === "string" && assumptions.dateStamp.trim() !== "") {
    parts.push(`stan na ${assumptions.dateStamp.trim()}`);
  }

  if (!parts.length) {
    return typeof assumptions.displayLine === "string" ? assumptions.displayLine : "";
  }

  return `Za\u0142o\u017cenia kalkulacji: ${parts.join(", ")}.`;
}

function buildPdfPageShell(title, subtitle, bodyHtml, footerNote = "") {
  return `
    <section class="pdf-page" data-pdf-page>
      <div class="pdf-page__header">
        <div class="pdf-brand">
          <div class="pdf-brand__eyebrow">TOP-INSTAL</div>
          <div class="pdf-brand__title">${escapePdfHtml(title)}</div>
          <div class="pdf-brand__subtitle">${escapePdfHtml(subtitle)}</div>
        </div>
      </div>
      <div class="pdf-page__body">${bodyHtml}</div>
      <div class="pdf-page__footer">
        <span>${escapePdfHtml(
          footerNote ||
            "TOP-INSTAL | propozycja wyceny przygotowana na podstawie danych z kalkulatora"
        )}</span>
      </div>
    </section>
  `;
}

function buildSimpleKeyValueTable(rows, emptyLabel = "Brak danych.") {
  const safeRows = Array.isArray(rows)
    ? rows.filter(
        (row) =>
          row &&
          row.label &&
          row.value !== undefined &&
          row.value !== null &&
          row.value !== ""
      )
    : [];
  if (!safeRows.length) {
    return `<div class="pdf-empty">${escapePdfHtml(emptyLabel)}</div>`;
  }

  return `
    <table class="pdf-table pdf-table--kv">
      <tbody>
        ${safeRows
          .map(
            (row) => `
              <tr>
                <th>${escapePdfHtml(row.label)}</th>
                <td>${escapePdfHtml(row.value)}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function buildSectionBlock(title, bodyHtml, options = {}) {
  const eyebrow = options.eyebrow
    ? `<div class="pdf-section__eyebrow">${escapePdfHtml(options.eyebrow)}</div>`
    : "";
  return `
    <section class="pdf-section">
      ${eyebrow}
      <h2 class="pdf-section__title">${escapePdfHtml(title)}</h2>
      <div class="pdf-section__content">${bodyHtml}</div>
    </section>
  `;
}

/** Zwraca pary etykieta/wartość dla sekcji parametrów budynku (PDF raportu energetycznego i legacy HTML). */
function buildPdfBuildingFieldRows(data) {
  if (!data || typeof data !== "object") {
    return [];
  }
  const rows = [];
  const pushField = (label, value) => {
    if (value === null || value === undefined || value === "") return;
    rows.push({ label: String(label), value: String(value) });
  };

  const materialMap = {
    64: "Korek",
    65: "Słoma",
    66: "Trzcina",
    68: "Wełna mineralna",
    69: "Wełna mineralna granulowana",
    70: "Styropian",
    71: "Styropian twardy (XPS)",
    81: "Padzierz lniany",
    82: "Pustka powietrzna",
    83: "Wiórobeton",
    86: "PUR",
    87: "Ekofiber",
    88: "Styropian grafitowy",
    94: "Wełna drzewna",
    95: "PIR",
    98: "Celuloza",
    101: "Multipor",
    51: "Beton",
    52: "Żelbet",
    53: "Pustak żużlobetonowy",
    54: "Beton komórkowy",
    55: "Drewno liściaste",
    56: "Drewno iglaste",
    57: "Cegła pełna",
    58: "Cegła dziurawka",
    59: "Cegła kratówka",
    60: "Cegła silikatowa pełna",
    61: "Cegła silikatowa dziurawka",
    62: "Cegła klinkierowa",
    63: "Pustaki ceramiczne",
    76: "Kamień polny",
    77: "Granit",
    78: "Marmur",
    79: "Piaskowiec",
    80: "Wapień",
    84: "Porotherm",
    85: "Pustak keramzytowy",
    89: "Ytong",
    90: "Termalica 300/400",
    91: "Termalica 600/650",
    92: "Thermomur",
    93: "Glina",
    96: "Bloczek silikatowy",
    97: "Keramzytobeton",
    99: "Ytong Ultra+",
    100: "Ytong PP5",
  };

  const garageTypeMap = {
    none: "Brak",
    single_unheated: "1-stanowisko, nieogrzewany",
    single_heated: "1-stanowisko, ogrzewany",
    double_unheated: "2-stanowiskowy, nieogrzewany",
    double_heated: "2-stanowiskowy, ogrzewany",
  };

  const hotWaterUsageMap = {
    shower: "Małe",
    shower_bath: "Średnie",
    bath: "Duże",
  };

  const ventilationTypeMap = {
    natural: "Grawitacyjna, naturalna",
    mechanical: "Mechaniczna",
    mechanical_recovery: "Mechaniczna z rekuperacją",
  };

  const roofTypeMap = {
    flat: "Płaski",
    steep: "Skośny - z przestrzenią poddasza",
    oblique: "Skośny bez przestrzeni poddasza",
  };

  const doorsTypeMap = {
    new_pvc: "Nowe PVC",
    new_wooden: "Nowe drewniane",
    new_metal: "Nowe metalowe",
    old_wooden: "Stare drewniane",
    old_metal: "Stare metalowe",
  };

  const surroundingsMap = {
    heated_room: "Ogrzewany lokal",
    unheated_room: "Nieogrzewany lokal",
    outdoor: "Świat zewnętrzny",
    ground: "Grunt",
  };

  const formatIsolation = (materialId, size) => {
    if (!materialId && !size) return null;
    const material = materialMap[materialId] || "";
    const sizeStr = size ? `${size}cm` : "";
    if (material && sizeStr) return `${material}, ${sizeStr}`;
    if (material) return material;
    if (sizeStr) return sizeStr;
    return null;
  };

  const formatDimensions = (length, width) => {
    if (length && width) return `${length}m × ${width}m`;
    if (length) return `Długość: ${length}m`;
    if (width) return `Szerokość: ${width}m`;
    return null;
  };

  const formatGarage = (hasGarage, garageType) => {
    if (hasGarage === "Nie" || !hasGarage) return null;
    if (garageType && garageType !== "none") {
      return `${hasGarage} - ${garageTypeMap[garageType] || garageType}`;
    }
    return hasGarage;
  };

  const formatHotWater = (include, persons, usage) => {
    if (include === "Nie" || !include) return null;
    const parts = [include];
    if (persons) {
      const personsNum = parseInt(persons, 10);
      if (personsNum === 1) {
        parts.push("1 osoba");
      } else if (personsNum > 1) {
        parts.push(`${personsNum} os.`);
      } else {
        parts.push(persons);
      }
    }
    if (usage) parts.push(`zużycie: ${hotWaterUsageMap[usage] || usage}`);
    return parts.join(", ");
  };

  const formatWindows = (windows, number) => {
    if (!windows && !number) return null;
    if (windows && number)
      return `${windows}, ${number} ${number === "1" ? "szt." : "szt."}`;
    if (windows) return windows;
    if (number) return `${number} ${number === "1" ? "szt." : "szt."}`;
    return null;
  };

  const formatDoors = (doorsType, number, isSimplifiedSingleHouse = false) => {
    if (isSimplifiedSingleHouse) {
      if (number) return `${number} ${number === "1" ? "szt." : "szt."}`;
      return null;
    }
    if (!doorsType && !number) return null;
    const type = doorsTypeMap[doorsType] || doorsType;
    if (type && number)
      return `${type}, ${number} ${number === "1" ? "szt." : "szt."}`;
    if (type) return type;
    if (number) return `${number} ${number === "1" ? "szt." : "szt."}`;
    return null;
  };

  const formatWall = (size, primary, secondary) => {
    const parts = [];
    if (size) parts.push(`${size}cm`);
    if (primary) parts.push(materialMap[primary] || primary);
    if (secondary) parts.push(`+ ${materialMap[secondary] || secondary}`);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  const constructionYearLabels = {
    2025: "2025",
    2021: "2021–2024",
    2011: "2011–2020",
    2000: "2000–2010",
    1990: "1991–2000",
    1980: "1981–1990",
    1970: "1971–1980",
    1960: "1961–1970",
    1950: "1950–1960",
    1940: "1940–1949",
    1939: "przed 1939",
  };

  if (data.building_type || data.building_type_label) {
    pushField("Typ budynku", data.building_type_label || data.building_type);
  }
  if (data.construction_year) {
    const yearLabel =
      constructionYearLabels[String(data.construction_year)] ||
      data.construction_year;
    pushField("Lata budowy", yearLabel);
  }
  if (data.construction_type) {
    pushField("Rodzaj konstrukcji", data.construction_type);
  }

  const dimensions = formatDimensions(data.building_length, data.building_width);
  if (dimensions) pushField("Wymiary zewnętrzne", dimensions);

  if (data.floor_perimeter) pushField("Obwód podłogi [m]", data.floor_perimeter);

  if (data.building_floors) pushField("Liczba kondygnacji", data.building_floors);
  if (data.floor_height) pushField("Wysokość kondygnacji [m]", data.floor_height);
  if (data.building_roof) {
    const roofType = roofTypeMap[data.building_roof] || data.building_roof;
    pushField("Rodzaj dachu", roofType);
  }

  if (data.has_basement) pushField("Piwnica", data.has_basement);
  if (data.has_balcony) pushField("Balkony", data.has_balcony);

  const garage = formatGarage(data.has_garage, data.garage_type);
  if (garage) pushField("Garaż", garage);

  const wall = formatWall(
    data.wall_size,
    data.primary_wall_material,
    data.secondary_wall_material
  );
  if (wall) pushField("Ściany zewnętrzne", wall);

  const isSimplifiedSingleHouse =
    data.building_type === "single_house" && data.detailed_insulation_mode !== true;

  if (isSimplifiedSingleHouse) {
    const insulationLevelMap = {
      poor: "niski",
      average: "średni",
      good: "dobry",
      very_good: "bardzo dobry",
    };

    if (data.walls_insulation_level) {
      pushField(
        "Izolacja ścian",
        insulationLevelMap[data.walls_insulation_level] || data.walls_insulation_level
      );
    }
    if (data.roof_insulation_level) {
      pushField(
        "Izolacja dachu",
        insulationLevelMap[data.roof_insulation_level] || data.roof_insulation_level
      );
    }
    if (data.floor_insulation_level) {
      pushField(
        "Izolacja podłogi",
        insulationLevelMap[data.floor_insulation_level] || data.floor_insulation_level
      );
    }
  } else {
    const topIsolation = formatIsolation(
      data.top_isolation_material,
      data.top_isolation_size
    );
    if (topIsolation) pushField("Izolacja dachu", topIsolation);

    const bottomIsolation = formatIsolation(
      data.bottom_isolation_material,
      data.bottom_isolation_size
    );
    if (bottomIsolation) pushField("Izolacja podłogi", bottomIsolation);

    const externalIsolation = formatIsolation(
      data.external_wall_isolation_material,
      data.external_wall_isolation_size
    );
    if (externalIsolation) pushField("Izolacja zewnętrzna ścian", externalIsolation);
  }

  const internalIsolation = formatIsolation(
    data.internal_wall_isolation_material,
    data.internal_wall_isolation_size
  );
  if (internalIsolation) pushField("Izolacja wewnętrzna ścian", internalIsolation);

  const windows = formatWindows(data.windows, data.number_windows);
  if (windows) pushField("Okna", windows);

  const doors = formatDoors(
    data.doors_type,
    data.number_doors,
    isSimplifiedSingleHouse
  );
  if (doors) pushField("Drzwi zewnętrzne", doors);

  if (data.indoor_temperature) {
    pushField("Temp. wewnętrzna [°C]", data.indoor_temperature);
  }
  if (data.ventilation_type) {
    const ventilation =
      ventilationTypeMap[data.ventilation_type] || data.ventilation_type;
    pushField("Wentylacja", ventilation);
  }

  const hotWater = formatHotWater(
    data.include_hot_water,
    data.hot_water_persons,
    data.hot_water_usage
  );
  if (hotWater) pushField("Podgrzewanie CWU", hotWater);

  if (data.on_corner) pushField("Budynek narożny", data.on_corner);

  const surroundings = [];
  if (data.whats_over)
    surroundings.push(`Nad: ${surroundingsMap[data.whats_over] || data.whats_over}`);
  if (data.whats_under)
    surroundings.push(`Pod: ${surroundingsMap[data.whats_under] || data.whats_under}`);
  if (data.whats_north)
    surroundings.push(
      `Północ: ${surroundingsMap[data.whats_north] || data.whats_north}`
    );
  if (data.whats_south)
    surroundings.push(
      `Południe: ${surroundingsMap[data.whats_south] || data.whats_south}`
    );
  if (data.whats_east)
    surroundings.push(`Wschód: ${surroundingsMap[data.whats_east] || data.whats_east}`);
  if (data.whats_west)
    surroundings.push(`Zachód: ${surroundingsMap[data.whats_west] || data.whats_west}`);

  if (surroundings.length > 0) {
    pushField("Otoczenie mieszkania", surroundings.join("; "));
  }

  return rows;
}

function buildHeatingCostsTable(list, options = {}) {
  const safeList = Array.isArray(list) ? list.filter(Boolean) : [];
  const highlightLeader = options.highlightLeader === true;
  if (!safeList.length) {
    return `<div class="pdf-empty">Brak danych o kosztach ogrzewania.</div>`;
  }

  return `
    <table class="pdf-table${highlightLeader ? " pdf-table--costs" : ""}">
      <thead>
        <tr>
          <th>Wariant ogrzewania</th>
          <th>Ogrzewanie / rok</th>
          <th>CWU / rok</th>
          <th>Razem / rok</th>
          <th>Sprawno\u015b\u0107 / SCOP</th>
        </tr>
      </thead>
      <tbody>
        ${safeList
          .map((entry) => {
            const label = entry.label || entry.fuel || "System";
            const detail = entry.detail
              ? `<div class="pdf-note-row">${escapePdfHtml(entry.detail)}</div>`
              : "";
            const leaderMark =
              highlightLeader && entry.is_cost_leader
                ? ` <span class="pdf-cost-leader">najni\u017cszy koszt energii</span>`
                : "";
            const rowClass =
              highlightLeader && entry.is_cost_leader ? ` class="pdf-row--leader"` : "";
            return `
              <tr${rowClass}>
                <td>
                  <div>${escapePdfHtml(label)}${leaderMark}</div>
                  ${detail}
                </td>
                <td>${escapePdfHtml(formatPdfCurrency(entry.annual_cost_co_pln))}</td>
                <td>${escapePdfHtml(formatPdfCurrency(entry.annual_cost_cwu_pln))}</td>
                <td><strong>${escapePdfHtml(
                  formatPdfCurrency(
                    entry.annual_cost_total_pln ??
                      entry.annual_cost_pln ??
                      entry.cost
                  )
                )}</strong></td>
                <td>${escapePdfHtml(
                  entry.efficiency_display || entry.efficiency || "nie dotyczy"
                )}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function buildEnergyLossesTable(list) {
  const safeList = Array.isArray(list) ? list.filter(Boolean) : [];
  if (!safeList.length) {
    return `<div class="pdf-empty">Brak szczeg\u00f3\u0142owego rozk\u0142adu strat ciep\u0142a.</div>`;
  }

  return `
    <table class="pdf-table">
      <thead>
        <tr>
          <th>Obszar</th>
          <th>Udzia\u0142</th>
        </tr>
      </thead>
      <tbody>
        ${safeList
          .map(
            (entry) => `
              <tr>
                <td>${escapePdfHtml(entry.name || entry.label || "Pozycja")}</td>
                <td>${escapePdfHtml(formatPdfMetric(entry.percent, "%", 1))}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function buildImprovementsList(list) {
  const safeList = Array.isArray(list) ? list.filter(Boolean) : [];
  if (!safeList.length) {
    return `<div class="pdf-empty">Brak wskazanych dzia\u0142a\u0144 modernizacyjnych.</div>`;
  }

  return `
    <ul class="pdf-list">
      ${safeList
        .map((entry) => {
          const saving =
            entry.saving !== null && entry.saving !== undefined
              ? `Szacowany potencja\u0142 oszcz\u0119dno\u015bci: ${formatPdfMetric(entry.saving, "%", 0)}.`
              : "Korzy\u015b\u0107 do potwierdzenia na audycie technicznym.";
          return `<li><strong>${escapePdfHtml(
            entry.title || entry.name || "Rekomendacja"
          )}</strong><span>${escapePdfHtml(saving)}</span></li>`;
        })
        .join("")}
    </ul>
  `;
}

function buildBivalentPointsTable(list) {
  const safeList = Array.isArray(list) ? list.filter(Boolean) : [];
  if (!safeList.length) {
    return `<div class="pdf-empty">W tym scenariuszu dodatkowe źródło szczytowe nie jest wymagane.</div>`;
  }

  return `
    <table class="pdf-table">
      <thead>
        <tr>
          <th>Temperatura zewn\u0119trzna</th>
          <th>Zapotrzebowanie [kW]</th>
        </tr>
      </thead>
      <tbody>
        ${safeList
          .map(
            (entry) => `
              <tr>
                <td>${escapePdfHtml(formatPdfMetric(entry.temp, "degC", 0))}</td>
                <td>${escapePdfHtml(formatPdfMetric(entry.power_kw, "kW", 1))}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function buildRecommendedModelsList(list) {
  const safeList = Array.isArray(list) ? list.filter(Boolean) : [];
  if (!safeList.length) {
    return `<div class="pdf-empty">Brak listy rekomendowanych modeli.</div>`;
  }

  return `
    <div class="pdf-model-grid">
      ${safeList
        .map((entry) => {
          const title =
            entry.title ||
            entry.model ||
            entry.label ||
            entry.name ||
            "Rekomendowany model";
          const subtitle =
            entry.subtitle ||
            entry.note ||
            entry.summary ||
            [entry.type, entry.phase ? `${entry.phase}F` : null, entry.power_kw ? `${entry.power_kw} kW` : null]
              .filter(Boolean)
              .join(" | ");
          return `
            <article class="pdf-model-card">
              <div class="pdf-model-card__title">${escapePdfHtml(title)}</div>
              <div class="pdf-model-card__meta">${escapePdfHtml(
                subtitle ||
                "Pompa dobrana do profilu energetycznego budynku (wg konfiguracji w kalkulatorze)."
              )}</div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function buildMachineRoomSummary(machineRoom, pricing, mode) {
  const summaryRows = Array.isArray(machineRoom?.summary_rows)
    ? machineRoom.summary_rows.filter((row) => row && row.label)
    : [];
  const items = Array.isArray(machineRoom?.items)
    ? machineRoom.items.filter(Boolean)
    : [];
  const totalBrutto =
    machineRoom?.total_brutto_pln ??
    pricing?.totals?.gross ??
    pricing?.total_gross_pln ??
    null;

  const summaryTable = buildSimpleKeyValueTable(
    summaryRows.map((row) => ({
      label: row.label,
      value: row.value || "nie dotyczy",
    })),
    "Brak podsumowania zestawu."
  );

  const itemsTable = items.length
    ? `
      <table class="pdf-table">
        <thead>
          <tr>
            <th>Element</th>
            <th>Ilo\u015b\u0107</th>
            <th>Cena brutto</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
                <tr>
                  <td>${escapePdfHtml(
                    item.name || item.label || item.code || "Pozycja"
                  )}</td>
                  <td>${escapePdfHtml(String(item.qty || item.quantity || 1))}</td>
                  <td>${escapePdfHtml(
                    formatPdfCurrency(
                      item.total_brutto_pln ??
                      item.total_gross_pln ??
                        item.totalGross ??
                        item.unit_brutto_pln ??
                        item.unit_gross_pln ??
                        item.unitPriceGross
                    )
                  )}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `
    : `<div class="pdf-empty">Brak szczeg\u00f3\u0142owej listy element\u00f3w maszynowni.</div>`;

  return `
    <div class="pdf-stack">
      ${summaryTable}
      ${itemsTable}
      <div class="pdf-total-box">
        <span>${escapePdfHtml(
          mode === "offer" ? "Cena ko\u0144cowa brutto" : "Warto\u015b\u0107 zestawu brutto"
        )}</span>
        <strong>${escapePdfHtml(formatPdfCurrency(totalBrutto))}</strong>
      </div>
    </div>
  `;
}

function renderEnergyPdfKvTable(rows) {
  const safe = Array.isArray(rows) ? rows.filter((r) => r && r.label) : [];
  if (!safe.length) {
    return `<div class="energy-pdf-muted">Brak danych.</div>`;
  }
  return `
    <table class="energy-pdf-kv">
      <tbody>
        ${safe
          .map(
            (r) => `
          <tr>
            <th>${escapePdfHtml(r.label)}</th>
            <td>${escapePdfHtml(r.value != null ? String(r.value) : "")}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderEnergyPdfTwoColumnKv(leftRows, rightRows) {
  return `
    <div class="energy-pdf-two-col">
      <div class="energy-pdf-col">${renderEnergyPdfKvTable(leftRows)}</div>
      <div class="energy-pdf-col">${renderEnergyPdfKvTable(rightRows)}</div>
    </div>
  `;
}

function buildEnergyLossesSummaryNote(list) {
  const safeList = Array.isArray(list) ? list.filter(Boolean) : [];
  if (!safeList.length) {
    return "";
  }
  const topAreas = safeList
    .slice()
    .sort((a, b) => Number(b.percent || 0) - Number(a.percent || 0))
    .slice(0, 3)
    .map((entry) => entry.name || entry.label || null)
    .filter(Boolean);
  if (!topAreas.length) {
    return "";
  }
  return `Największy udział w stratach mają: ${topAreas.join(", ")}.`;
}

/**
 * Tryb energy: techniczny raport cieplny (bez oferty, cen, maszynowni i slownictwa systemowego).
 */
function buildEnergyReportPdfMarkup(data) {
  const accent = "#dc2626";
  const dateLabel = escapePdfHtml(
    (data && data.report_date_label) ||
      new Date().toLocaleDateString("pl-PL")
  );
  const ozcLeft = Array.isArray(data?.energy_ozc_rows_left) ? data.energy_ozc_rows_left : [];
  const ozcRight = Array.isArray(data?.energy_ozc_rows_right) ? data.energy_ozc_rows_right : [];
  const buildingRows = buildPdfBuildingFieldRows(data || {});
  const half = Math.ceil(buildingRows.length / 2);
  const buildingLeft = buildingRows.slice(0, half);
  const buildingRight = buildingRows.slice(half);

  const pumpTitle = escapePdfHtml(
    (data && data.pump_selection_summary && data.pump_selection_summary.primary_line) ||
      "Dobór pompy ciepła"
  );
  const pumpSecondary =
    data && data.pump_selection_summary && data.pump_selection_summary.secondary_line
      ? `<div class="energy-pdf-subline">${escapePdfHtml(
          data.pump_selection_summary.secondary_line
        )}</div>`
      : "";
  const pumpNote =
    data && data.pump_selection_summary && data.pump_selection_summary.note
      ? `<p class="energy-pdf-note">${escapePdfHtml(data.pump_selection_summary.note)}</p>`
      : `<p class="energy-pdf-note">Dob\u00f3r mocy wykonano na podstawie obliczonego zapotrzebowania ciep\u0142nego oraz regu\u0142 stosowanych w kalkulatorze TOP-INSTAL.</p>`;

  const costsHtml = buildHeatingCostsTable(data?.costs_comparison || [], {
    highlightLeader: false,
  });
  const assumptionsLine = escapePdfHtml(
    buildPdfCostAssumptionsLine(data?.costs_assumptions) || ""
  );
  const lossesHtml = buildEnergyLossesTable(data?.energy_losses || []);
  const lossesSummaryNote = buildEnergyLossesSummaryNote(data?.energy_losses || []);
  const bivHtml = buildBivalentPointsTable(data?.bivalent_points || []);

  const sharedStyle = `
    <style>
      .energy-pdf-page {
        width: 794px;
        min-height: 1123px;
        box-sizing: border-box;
        padding: 36px 44px 32px;
        background: #ffffff;
        color: #111827;
        font-family: 'Inter', 'Segoe UI', 'DejaVu Sans', 'Noto Sans', Arial, Helvetica, sans-serif;
        font-size: 12px;
        line-height: 1.45;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .energy-pdf-page + .energy-pdf-page { margin-top: 12px; }
      .energy-pdf-topbar {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        padding-top: 8px;
        padding-bottom: 10px;
        border-top: 2px solid ${accent};
        border-bottom: 1px solid #e5e7eb;
      }
      .energy-pdf-title {
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.2px;
        text-transform: uppercase;
      }
      .energy-pdf-date { font-size: 11px; color: #6b7280; }
      .energy-pdf-section-title {
        margin: 4px 0 8px;
        font-size: 12px;
        font-weight: 500;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding-bottom: 4px;
        border-bottom: 2px solid ${accent};
      }
      .energy-pdf-two-col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        align-items: start;
      }
      .energy-pdf-kv { width: 100%; border-collapse: collapse; font-size: 11px; }
      .energy-pdf-kv th,
      .energy-pdf-kv td {
        padding: 5px 4px;
        border-bottom: 1px solid #e5e7eb;
        vertical-align: top;
      }
      .energy-pdf-kv th {
        width: 52%;
        text-align: left;
        font-weight: 500;
        color: #4b5563;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .energy-pdf-kv td {
        text-align: right;
        font-weight: 600;
        text-transform: uppercase;
      }
      .energy-pdf-muted { color: #6b7280; font-size: 11px; }
      .energy-pdf-note { color: #4b5563; font-size: 11px; margin: 8px 0 0; }
      .energy-pdf-subline {
        margin-top: 6px;
        font-size: 11px;
        color: #4b5563;
      }
      .energy-pdf-pump-line {
        font-size: 14px;
        font-weight: 700;
        color: #111827;
        margin: 4px 0 0;
      }
      .energy-pdf-footer {
        margin-top: auto;
        padding-top: 12px;
        border-top: 2px solid ${accent};
        text-align: center;
        font-size: 10px;
        color: #6b7280;
      }
      .energy-pdf-table-wrap .pdf-table { font-size: 11px; }
      .energy-pdf-table-wrap .pdf-table th,
      .energy-pdf-table-wrap .pdf-table td { padding: 7px 8px; }
      .pdf-table.pdf-table--costs .pdf-row--leader td {
        background: #fff7f7;
      }
      .pdf-cost-leader {
        display: inline-block;
        margin-left: 6px;
        padding: 1px 6px;
        border-radius: 4px;
        background: #fee2e2;
        color: #991b1b;
        font-size: 9px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
    </style>
  `;

  const pageOne = `
    <section class="energy-pdf-page" data-pdf-page>
      <div class="energy-pdf-topbar">
        <div class="energy-pdf-title">RAPORT CIEPLNY BUDYNKU | TOP-INSTAL INNOVATIONS</div>
        <div class="energy-pdf-date">${dateLabel}</div>
      </div>
      <div>
        <div class="energy-pdf-section-title">Profil energetyczny budynku</div>
        ${renderEnergyPdfTwoColumnKv(ozcLeft, ozcRight)}
      </div>
      <div>
        <div class="energy-pdf-section-title">Informacje o budynku</div>
        ${renderEnergyPdfTwoColumnKv(buildingLeft, buildingRight)}
      </div>
      <div>
        <div class="energy-pdf-section-title">Rekomendowana moc pompy ciepła</div>
        <div class="energy-pdf-pump-line">${pumpTitle}</div>
        ${pumpSecondary}
        ${pumpNote}
      </div>
    </section>
  `;

  const pageTwo = `
    <section class="energy-pdf-page" data-pdf-page>
      <div>
        <div class="energy-pdf-section-title">Punkty biwalentne</div>
        <div class="energy-pdf-table-wrap">${bivHtml}</div>
      </div>
      <div>
        <div class="energy-pdf-section-title">Porównanie kosztów ogrzewania (szacunek roczny)</div>
        <div class="energy-pdf-table-wrap">${costsHtml}</div>
        ${
          assumptionsLine
            ? `<div class="energy-pdf-muted" style="margin-top:8px;">${assumptionsLine}</div>`
            : ""
        }
      </div>
      <div>
        <div class="energy-pdf-section-title">Analiza strat ciepła</div>
        <div class="energy-pdf-table-wrap">${lossesHtml}</div>
        ${
          lossesSummaryNote
            ? `<div class="energy-pdf-muted" style="margin-top:8px;">${escapePdfHtml(
                lossesSummaryNote
              )}</div>`
            : ""
        }
      </div>
      <div class="energy-pdf-footer">
        <strong style="color:${accent};">TOP-INSTAL INNOVATIONS</strong> | www.topinstal.com.pl<br />
        <span style="display:block;margin-top:8px;">
          Raport ma charakter informacyjny. Wyniki są szacunkowe i wymagają potwierdzenia podczas doboru technicznego.
        </span>
      </div>
    </section>
  `;

  return `${sharedStyle}${pageOne}${pageTwo}`;
}

function createPdfPagesMarkup(data, options = {}) {
  const mode = resolvePdfMode(options);
  if (mode === "energy") {
    return buildEnergyReportPdfMarkup(data);
  }
  const today = new Date().toLocaleDateString("pl-PL");
  const energyRows = Array.isArray(data?.energy_profile_rows)
    ? data.energy_profile_rows
    : [];
  const summaryRows = [
    {
      label: "Typ budynku",
      value: data?.building_type_label || "brak danych",
    },
    {
      label: "Powierzchnia ogrzewana",
      value: formatPdfMetric(data?.heated_area, "m2", 0),
    },
    {
      label: "Projektowa strata ciep\u0142a",
      value: formatPdfMetric(data?.max_heating_power, "kW", 2),
    },
    {
      label: "Rekomendowana moc pompy",
      value: formatPdfMetric(data?.recommended_power_kw, "kW", 1),
    },
    {
      label: "Temperatura wewn\u0119trzna",
      value: formatPdfMetric(data?.indoor_temperature, "degC", 0),
    },
    {
      label: "Temperatura obliczeniowa (zewn\u0119trzna)",
      value: formatPdfMetric(data?.design_outdoor_temperature, "degC", 0),
    },
    { label: "Data dokumentu", value: today },
  ];
  const pricingGross =
    data?.machine_room?.total_brutto_pln ??
    data?.pricing?.totals?.gross ??
    data?.pricing?.total_gross_pln ??
    null;
  const assumptionsText =
    buildPdfCostAssumptionsLine(data?.costs_assumptions) ||
    [
      data?.costs_assumptions?.annualKWhCO != null
        ? `CO: ${formatPdfMetric(data.costs_assumptions.annualKWhCO, "kWh", 0)}`
        : null,
      data?.costs_assumptions?.annualKWhCWU != null
        ? `CWU: ${formatPdfMetric(data.costs_assumptions.annualKWhCWU, "kWh", 0)}`
        : null,
      data?.costs_assumptions?.scopUsed != null
        ? `SCOP: ${formatPdfMetric(data.costs_assumptions.scopUsed, "", 1)}`
        : null,
    ]
      .filter(Boolean)
      .join(" | ");

  const pageOne = buildPdfPageShell(
    "Podsumowanie konfiguracji TOP-INSTAL",
    "Wycena orientacyjna na podstawie danych z kalkulatora oraz wyniku oblicze\u0144 przygotowanego w systemie TOP-INSTAL.",
    `
      <div class="pdf-grid pdf-grid--hero">
        <div class="pdf-hero-card">
          <div class="pdf-hero-card__eyebrow">Warto\u015b\u0107 bie\u017c\u0105cego zestawu</div>
          <div class="pdf-hero-card__value">${escapePdfHtml(
            formatPdfCurrency(pricingGross)
          )}</div>
          <div class="pdf-hero-card__note">
            Kwota brutto odnosi si\u0119 do konfiguracji widocznej w podsumowaniu kalkulatora. Ostateczna wycena mo\u017ce ulec zmianie po weryfikacji technicznej.
          </div>
        </div>
        ${buildSectionBlock(
          "Najwa\u017cniejsze parametry",
          buildSimpleKeyValueTable(
            summaryRows,
            "Brak danych podstawowych do wy\u015bwietlenia."
          )
        )}
      </div>
      ${buildSectionBlock(
        "Profil energetyczny",
        buildSimpleKeyValueTable(
          energyRows,
          "Brak danych profilu energetycznego."
        ),
        { eyebrow: "Dane techniczne" }
      )}
    `,
    "TOP-INSTAL | materia\u0142 informacyjny dla klienta"
  );

  const pageTwo = buildPdfPageShell(
    "Koszty eksploatacji i bilans strat",
    "Szacunki por\u00f3wnawcze oraz rozk\u0142ad strat ciep\u0142a wg modelu obliczeniowego budynku.",
    `
      ${buildSectionBlock(
        "Por\u00f3wnanie koszt\u00f3w ogrzewania",
        buildHeatingCostsTable(data?.costs_comparison),
        { eyebrow: "Szacunek roczny" }
      )}
      <div class="pdf-grid pdf-grid--two">
        ${buildSectionBlock(
          "Straty ciep\u0142a",
          buildEnergyLossesTable(data?.energy_losses)
        )}
        ${buildSectionBlock(
          "Mo\u017cliwe usprawnienia",
          buildImprovementsList(data?.improvements)
        )}
      </div>
      ${buildSectionBlock(
        "Punkty biwalentne i za\u0142o\u017cenia",
        `
          ${buildBivalentPointsTable(data?.bivalent_points)}
          <div class="pdf-note">${escapePdfHtml(
            assumptionsText || "Brak dodatkowych za\u0142o\u017ce\u0144 kosztowych."
          )}</div>
        `,
        { eyebrow: "Warunki pracy" }
      )}
    `,
    "Dane techniczne z modu\u0142u obliczeniowego budynku"
  );

  const pageThree = buildPdfPageShell(
    "Zestaw rekomendowany",
    "Przegl\u0105d dobranych urz\u0105dze\u0144 i pozycji zestawu zgodnie z aktualn\u0105 konfiguracj\u0105.",
    `
      ${buildSectionBlock(
        "Rekomendowane modele",
        buildRecommendedModelsList(data?.recommended_models),
        { eyebrow: "Dob\u00f3r pompy" }
      )}
      ${buildSectionBlock(
        "Podsumowanie zestawu",
        buildMachineRoomSummary(data?.machine_room, data?.pricing, mode),
        { eyebrow: "Sk\u0142ad oferty" }
      )}
      ${buildSectionBlock(
        "Uwagi ko\u0144cowe",
        `
          <div class="pdf-note">
            Dokument ma charakter pomocniczy przy rozmowie z doradc\u0105 TOP-INSTAL.
            Zakres monta\u017cu, osprz\u0119tu oraz warunki realizacji potwierdzane s\u0105 indywidualnie po audycie technicznym.
          </div>
        `
      )}
    `,
    "TOP-INSTAL | kontakt: biuro@topinstal.com.pl | tel. 600 000 000"
  );

  return `
    <style>
      .pdf-page {
        width: 794px;
        min-height: 1123px;
        box-sizing: border-box;
        padding: 40px 46px 34px;
        background: #ffffff;
        color: #111827;
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .pdf-page + .pdf-page {
        margin-top: 16px;
      }
      .pdf-page__header {
        border-bottom: 2px solid #dc2626;
        padding-bottom: 14px;
      }
      .pdf-brand__eyebrow {
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #6b7280;
        margin-bottom: 10px;
      }
      .pdf-brand__title {
        font-size: 28px;
        font-weight: 700;
        color: #111827;
        line-height: 1.15;
        margin-bottom: 8px;
      }
      .pdf-brand__subtitle {
        font-size: 13px;
        line-height: 1.5;
        color: #4b5563;
      }
      .pdf-page__body {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .pdf-page__footer {
        border-top: 1px solid #e5e7eb;
        padding-top: 10px;
        font-size: 10px;
        color: #6b7280;
      }
      .pdf-grid {
        display: grid;
        gap: 16px;
      }
      .pdf-grid--hero {
        grid-template-columns: 230px 1fr;
        align-items: stretch;
      }
      .pdf-grid--two {
        grid-template-columns: 1fr 1fr;
      }
      .pdf-hero-card,
      .pdf-section {
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        padding: 18px 20px;
        background: #ffffff;
      }
      .pdf-hero-card {
        background: linear-gradient(180deg, #fff5f5 0%, #ffffff 100%);
        border-color: #fecaca;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .pdf-hero-card__eyebrow,
      .pdf-section__eyebrow {
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #9ca3af;
        margin-bottom: 8px;
      }
      .pdf-hero-card__value {
        font-size: 30px;
        font-weight: 700;
        color: #991b1b;
        margin-bottom: 10px;
      }
      .pdf-hero-card__note,
      .pdf-note,
      .pdf-note-row {
        font-size: 12px;
        line-height: 1.5;
        color: #4b5563;
      }
      .pdf-note-row {
        margin-top: 4px;
      }
      .pdf-section__title {
        margin: 0 0 12px;
        font-size: 16px;
        line-height: 1.25;
        color: #111827;
      }
      .pdf-section__content {
        font-size: 12px;
      }
      .pdf-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      .pdf-table th,
      .pdf-table td {
        padding: 9px 10px;
        border-bottom: 1px solid #e5e7eb;
        text-align: left;
        vertical-align: top;
      }
      .pdf-table thead th {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #6b7280;
        background: #f9fafb;
      }
      .pdf-table--kv th {
        width: 42%;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        font-size: 11px;
        background: #fafafa;
      }
      .pdf-empty {
        padding: 12px 14px;
        border-radius: 12px;
        background: #f9fafb;
        color: #6b7280;
        font-size: 12px;
      }
      .pdf-list {
        margin: 0;
        padding-left: 18px;
        display: grid;
        gap: 10px;
      }
      .pdf-list li {
        display: grid;
        gap: 4px;
      }
      .pdf-model-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .pdf-model-card {
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 14px 16px;
        background: #fafafa;
      }
      .pdf-model-card__title {
        font-size: 14px;
        font-weight: 700;
        color: #111827;
        margin-bottom: 6px;
      }
      .pdf-model-card__meta {
        font-size: 12px;
        line-height: 1.45;
        color: #4b5563;
      }
      .pdf-stack {
        display: grid;
        gap: 12px;
      }
      .pdf-total-box {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 16px;
        border-radius: 14px;
        background: #111827;
        color: #ffffff;
        font-size: 13px;
      }
      .pdf-total-box strong {
        font-size: 20px;
      }
    </style>
    ${pageOne}
    ${pageTwo}
    ${pageThree}
  `;
}

function createPDFContent(data, options = {}) {
  const mode = resolvePdfMode(options);
  const payload =
    mode === "energy" &&
    typeof window !== "undefined" &&
    typeof window.buildEnergyReportData === "function"
      ? window.buildEnergyReportData(data)
      : data;
  return createPdfPagesMarkup(payload, { mode });
}

// Eksportuj funkcje do window
window.generatePdf = generatePdf;
window.generateOfferPDF = function generateOfferPDFCompat(configData) {
  return generatePdf(configData, { mode: "offer" });
};
window.createPDFContent = createPDFContent;
