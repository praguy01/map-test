import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {MdSatelliteAlt,MdCropRotate,MdAccessTimeFilled} from "react-icons/md";
import {FaChevronRight,FaChevronLeft} from "react-icons/fa";
import {FiChevronLeft,FiChevronRight,FiChevronDown,FiMenu,FiMapPin,FiGlobe ,FiPieChart} from "react-icons/fi";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

function MapDashboard() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [features, setFeatures] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
  const [isSubMenutimeOpen, setIsSubMenutimeOpen] = useState(false);
  const [isDayMode, setIsDayMode] = useState(true);
  const [markers, setMarkers] = useState([]);
  const [allFeatures, setAllFeatures] = useState([]);
  const [timePeriod, setTimePeriod] = useState("");
  const [selectedDate, setSelectedDate] = useState("2024-01-07"); // ใช้เพื่อเก็บวันที่ที่เลือก
  const [isLoading, setIsLoading] = useState(true); // ใช้สำหรับแสดง Loader
  const hasZoomedRef = useRef(false);
  const [currentFilterType, setCurrentFilterType] = useState("all");
  const [isDataReady, setIsDataReady] = useState(false);



  const filterFeatures = (type) => {
    if (!allFeatures.length) return;
  
    let filtered = [...allFeatures];
  
    // กรองตามวันที่
    if (selectedDate) {
      filtered = filtered.filter((f) => f.properties?.th_date === selectedDate);
    }
  
    // กรองตามช่วงเวลา
    filtered = filterByTime(filtered, isDayMode);
  
    // กรองตามประเภทดาวเทียม
    switch (type) {
      case "modis":
        filtered = filtered.filter((f) => f.properties.bright_t31 !== null);
        break;
      case "viirs_ti4":
        filtered = filtered.filter((f) => f.properties.bright_ti4 !== null);
        break;
      case "viirs_ti5":
        filtered = filtered.filter((f) => f.properties.bright_ti5 !== null);
        break;
      case "all":
      default:
        // ไม่ต้องกรองเพิ่ม
        break;
    }
  
    setFeatures(filtered);
  };
  

  const filterByTime = (features, isDayMode) => {
    return features.filter((f) => {
      const timeStr = f.properties?.th_time;
      if (!timeStr || timeStr.length !== 4) return false;
      const hour = parseInt(timeStr.slice(0, 2), 10);
      return isDayMode ? hour >= 6 && hour < 18 : hour < 6 || hour >= 18;
    });
  };

  useEffect(() => {
    hasZoomedRef.current = false;
  }, [selectedDate]);


  useEffect(() => {
    if (isDataReady) {
      filterFeatures(currentFilterType);
    }
  }, [selectedDate, isDayMode, currentFilterType, isDataReady]);
  

  const handleFilter = (type) => {
    setCurrentFilterType(type);
    if (isDataReady) {
      filterFeatures(type);
    }
  };
  

  
  const [heatSummary, setHeatSummary] = useState({
    "> 320": 0,
    "> 310": 0,
    ">= 295": 0,
    "< 294": 0,
  });

  const colorMap = {
    "> 320": "#ef4444",      // red-500
    "> 310": "#fb923c",      // orange-400
    ">= 295": "#fde047", // yellow-300
    "< 294": "#d1d5db",         // gray-300
  };

  const pieData = Object.entries(heatSummary).map(([label, count]) => ({
    name: label,
    value: count,
    color: colorMap[label],
  }));

  
  
  const getHeatmapGeoJSON = (features) => ({
    type: "FeatureCollection",
    features: features
      .filter((f) => f.geometry?.coordinates)
      .map((f) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: f.geometry.coordinates,
        },
        properties: {
          intensity:
            f.properties.bt_i4_k_ ??
            f.properties.bt_i5_k_ ??
            f.properties?.bright_t31 ??
            f.properties?.bright_ti4 ??
            f.properties?.bright_ti5 ??
            0,
          satellite: f.properties?.satellite || null,
          th_date: f.properties?.th_date || null,
          th_time: f.properties?.th_time || null,
          ct_en: f.properties?.ct_en || null,
          amphoe: f.properties?.amphoe || null,
          changwat: f.properties?.changwat || null,
          tambol: f.properties?.tambol || null,
          village: f.properties?.village || null,
          lu_hp_name: f.properties?.lu_hp_name || null,
          lu_name: f.properties?.lu_name || null,
        },
      })),
  });

  
  
  const fetchAllFeatures = async (url, collected = [], onUpdate = () => {}, selectedDate = null) => {
    const res = await fetch(url);
    const data = await res.json();
    const features = data.features || [];
  
    const nextLink = data.links?.find(l => l.rel === "next")?.href;
  
    const combined = [...collected, ...features];
  
    // กรองก่อนแสดง
    if (selectedDate) {
      const filtered = combined.filter(f => f.properties?.th_date === selectedDate);
      onUpdate(filtered);
    } else {
      onUpdate(combined); // กรณีไม่กรอง
    }
  
    if (nextLink) {
      return fetchAllFeatures(nextLink, combined, onUpdate, selectedDate);
    }
  
    return combined;
  };
  

  useEffect(() => {
    let baseUrl = "https://v2k-dev.vallarismaps.com/core/api/features/1.1/collections/658cd4f88a4811f10a47cea7/items";
    let params = new URLSearchParams({
      limit: 10000,
      api_key: "bLNytlxTHZINWGt1GIRQBUaIlqz9X45XykLD83UkzIoN6PFgqbH7M7EDbsdgKVwC"
    });
  
    if (selectedDate) {
      params.append("th_date", selectedDate); 
    }
  
    const url = `${baseUrl}?${params.toString()}`;
    console.log("Full URL:", url); //ดูว่า query ถูกต้องไหม
  
    setIsLoading(true);
    setIsDataReady(false); // ก่อนโหลดใหม่
  
    fetchAllFeatures(url, [], (partialFiltered) => {
      setFeatures(partialFiltered);
    }, selectedDate).then((allData) => {
      setAllFeatures(allData);
      setIsLoading(false);
      setIsDataReady(true); // ข้อมูลพร้อม
    });
  }, [selectedDate]);
  
  
  
  useEffect(() => {
    if (!mapContainer.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://api.maptiler.com/maps/streets/style.json?key=57Ws3lPQEWApi6k0NwmI",
      center: [100.5018, 13.7563],
      zoom: 5,
    });

    mapRef.current.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      "top-right"
    );

    return () => mapRef.current.remove();
  }, []);

  useEffect(() => {
    if (!mapRef.current || features.length === 0) return;
  
    // กรองตามวันที่และช่วงเวลา (กลางวัน/กลางคืน)
    const filteredFeatures = filterByTime(
      features.filter((f) => f.properties?.th_date === selectedDate),
      isDayMode
    );
  
    const summary = {
      "> 320": 0,
      "> 310": 0,
      ">= 295": 0,
      "< 294": 0,
    };
  
    filteredFeatures.forEach((feature) => {
      const brightnessRaw =
      feature.properties.bt_i4_k_ ??
      feature.properties.bt_i5_k_ ??
      feature.properties.brightness ??
      feature.properties.bright_t31 ??
      feature.properties.bright_ti4 ??
      feature.properties.bright_ti5;
    
    const brightness = parseFloat(brightnessRaw) || 0;
    feature.properties.intensity = brightness;
    
    //console.log("Brightness:", brightness, "From:", feature.properties);
    
  
      if (brightness > 320) summary["> 320"]++;
      else if (brightness > 310) summary["> 310"]++;
      else if (brightness >= 295) summary[">= 295"]++;
      else summary["< 294"]++;
    });
  
    setHeatSummary(summary);

    
    const geojson = getHeatmapGeoJSON(filteredFeatures);
    //console.log("GEOJSON DATA", geojson);

  
    const updateMap = () => {
      if (mapRef.current.getSource("heat")) {
        mapRef.current.getSource("heat").setData(geojson);
      } else {
        mapRef.current.addSource("heat", {
          type: "geojson",
          data: geojson,
        });
  
        mapRef.current.addLayer({
          id: "heatmap-layer",
          type: "heatmap",
          source: "heat",
          maxzoom: 15,
          paint: {
            "heatmap-weight": [
              "interpolate",
              ["linear"],
              ["get", "intensity"],
              295, 0,
              340, 1,
            ],
            "heatmap-intensity": 1.2,
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0, "rgba(33,102,172,0)",
              0.2, "rgb(103,169,207)",
              0.4, "rgb(209,229,240)",
              0.6, "rgb(253,219,199)",
              0.8, "rgb(239,138,98)",
              1, "rgb(178,24,43)"
            ],
            "heatmap-radius": 20,
            "heatmap-opacity": 0.8,
          },
        });
  
        mapRef.current.addLayer({
          id: "heatmap-point-layer",
          type: "circle",
          source: "heat",
          minzoom: 5,
          paint: {
            "circle-radius": 8,  // เพิ่มขนาดจุด
            "circle-color": "#ff0000",  // เปลี่ยนสีเป็นสีแดงเพื่อให้มองเห็นได้ชัด
            "circle-opacity": 1,  // เพิ่มความทึบของจุด
          },
        });
  
        mapRef.current.on("click", "heatmap-point-layer", async (e) => {
          const coords = e.features[0].geometry.coordinates.slice();
          const props = e.features[0].properties;
        
          const dateStr = props.th_date;
          const timeStr = props.th_time;
          let formattedDate = "-";
        
          if (dateStr && timeStr?.length === 4) {
            const dateTime = new Date(`${dateStr}T${timeStr.slice(0, 2)}:${timeStr.slice(2)}:00`);
            formattedDate = new Intl.DateTimeFormat("th-TH", {
              dateStyle: "long",
              timeStyle: "short",
            }).format(dateTime);
          }

          const isThailand = props.ct_en === "Thailand";
          console.log("Country check (props.ct_en):", isThailand);
          const locationDetails = isThailand
          
            ? `
                <strong>📌 จังหวัด:</strong> ${props.pv_tn || props.changwat || "-"}<br/>
                <strong>🏞️ อำเภอ:</strong> ${props.ap_tn || props.amphoe || "-"}<br/>
                <strong>🏘️ ตำบล:</strong> ${props.tb_tn || props.tambol || "-"}<br/>
                <strong>🏘️ หมู่บ้าน:</strong> ${props.village  || "-"}<br/>
                <strong>🌱 พืชที่ปลูก:</strong> ${props.lu_hp_name || "-"}<br/>
                <strong>🏞️ ประเภทที่ดิน:</strong> ${props.lu_name || "-"}<br/>
            `
            : "";
            console.log("Popup Location Details:", locationDetails);
            console.log("Popup Properties:", props);

          const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
            <div style="font-size: 14px; line-height: 1.5; max-height: 150px; overflow-y: auto;">
              <strong></strong> ${formattedDate}<br/>
              <strong>🛰️ ดาวเทียม:</strong> ${props.satellite || "-"}<br/>
              <strong>🔥 ความร้อน:</strong> ${props.intensity || "-"}<br/>
              <strong>📍 ลองจิจูด:</strong> ${coords[0].toFixed(4)}<br/>
              <strong>📍 ละติจูด:</strong> ${coords[1].toFixed(4)}<br/>
              ${locationDetails}
            </div>
          `);
          popup.setLngLat(coords).addTo(mapRef.current);
        });
        
      }
  
      // Zoom to bounds
    if (!hasZoomedRef.current) {
      const bounds = new maplibregl.LngLatBounds();
      filteredFeatures.forEach((f) => {
        const coords = f.geometry?.coordinates;
        if (coords) bounds.extend(coords);
      });

      if (!bounds.isEmpty()) {
        mapRef.current.fitBounds(bounds, { padding: 40, maxZoom: 8 });
        hasZoomedRef.current = true; // ซูมแค่ครั้งแรกเท่านั้น
      }
    }
  };

  if (mapRef.current.isStyleLoaded()) {
    updateMap();
  } else {
    mapRef.current.once("load", updateMap);
  }
}, [features, isDayMode, selectedDate]);
  

  useEffect(() => {
    markers.forEach((marker) => {
      if (isDayMode) {
        marker.addTo(mapRef.current);
      } else {
        marker.remove();
      }
    });
  }, [isDayMode, markers]);

  const rotateMap = () => {
    const bearing = mapRef.current.getBearing();
    mapRef.current.rotateTo(bearing + 45, { duration: 1000 });
  };

  const filteredFeatures = filterByTime(
    features.filter((f) => f.properties?.th_date === selectedDate),
    isDayMode
  );

  

  const getFeatureCounts = () => {
    const counts = {};
    filteredFeatures.forEach((f) => {
      const country = f.properties.ct_tn || "ไม่ทราบประเทศ";
      counts[country] = (counts[country] || 0) + 1;
    });
    return Object.entries(counts);
  };
  
  const landTypeSummary = filteredFeatures.reduce((acc, feature) => {
    const landType = feature.properties?.lu_name || "-";
    acc[landType] = (acc[landType] || 0) + 1;
    return acc;
  }, {});
  
  
  
  

  const getHeatIntensityCounts = () => {
    // คำนวณความถี่ของแต่ละช่วงความร้อน
    const intensityCounts = features.reduce((acc, feature) => {
      const intensity = feature.properties?.bright_t31 || feature.properties?.bright_ti4 || feature.properties?.bright_ti5 || 0;
  
      let colorCategory;
      if (intensity < 50) colorCategory = "ต่ำ (0-50)";
      else if (intensity >= 50 && intensity < 100) colorCategory = "ปานกลาง (50-100)";
      else colorCategory = "สูง (100+)";
  
      acc[colorCategory] = (acc[colorCategory] || 0) + 1;
      return acc;
    }, {});
  
    return Object.entries(intensityCounts);
  };
  
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
  
    if (isSidebarOpen && isMobile) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.documentElement.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.touchAction = '';
    }
  
    const handleResize = () => {
      const isMobileNow = window.innerWidth < 768;
      if (isSidebarOpen && isMobileNow) {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';
        document.documentElement.style.touchAction = 'none';
      } else {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        document.body.style.touchAction = '';
        document.documentElement.style.touchAction = '';
      }
    };
  
    window.addEventListener("resize", handleResize);
  
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.touchAction = '';
      window.removeEventListener("resize", handleResize);
    };
  }, [isSidebarOpen]);
  
  
  
  
  

  return (
    <div className="relative h-screen w-screen flex">
      {/* --- Sidebar --- */}
      <div
          className={`fixed top-0 left-0 h-screen bg-black/85 text-white flex flex-col z-40 transition-all duration-300 ease-in-out
          ${isSidebarOpen ? "w-60" : "w-0 md:w-24"} md:flex overflow-hidden rounded-r-3xl `}
      >
        <div className="flex items-center justify-between p-5">
          {!isSidebarOpen ? null : (
            <span className="text-2xl font-bold text-white ">🗺️ Tool</span>
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} >
            {isSidebarOpen ? (
              <FaChevronLeft />
            ) : (
              <span className="flex items-center gap-1 text-2xl">
                🗺️ <FaChevronRight />
              </span>
            )}
          </button>
        </div>

        <nav className="space-y-4 px-3">
         {/* --- Time --- */}
         <div className="relative group">
            <div
              className="flex items-center px-3 py-2 rounded cursor-pointer transition hover:bg-gray-800"
              onClick={() => {
                if (!isSidebarOpen) {
                  setIsSidebarOpen(true); // เปิด Sidebar ก่อน
                } else {
                  setIsSubMenutimeOpen(!isSubMenutimeOpen); //toggle submenu เฉพาะตอนเปิดอยู่แล้ว
                }
              }}
            >
              <MdAccessTimeFilled className="text-3xl" />
              {isSidebarOpen && (
                <>
                  <span className="ml-2 flex-1 text-lg">Date</span>
                  <span>
                    {isSubMenutimeOpen ? <FiChevronDown /> : <FiChevronRight />}
                  </span>
                </>
              )}
            </div>
            {!isSidebarOpen && (
              <div className="absolute left-24 top-2 opacity-0 group-hover:opacity-100 transition-opacity text-sm bg-black text-white px-2 py-1 rounded-md shadow-lg whitespace-nowrap z-40">
                Time
              </div>
            )}
              {isSubMenutimeOpen && isSidebarOpen && (
                <div className="ml-8 mt-1 space-y-2 text-sm">
                  {/* เลือกวันที่ */}
                  <div>
                    <label htmlFor="date-picker" className="block mb-1 text-gray-300">เลือกวันที่</label>
                    <input
                        type="date"
                        id="date-picker"
                        className="bg-gray-800 text-white px-2 py-1 rounded w-full"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        min="2024-01-07"
                        max="2024-01-25"
                      />

                </div>

                {/* เลือกช่วงเวลา */}
                {selectedDate && (
                  <div className="space-y-1">
                    <button
                      className={`block w-full text-left text-base px-2 py-2 rounded hover:bg-gray-800 ${isDayMode ? "bg-gray-700" : ""}`}
                      onClick={() => setIsDayMode(true)}
                    >
                      กลางวัน (06:00 - 18:00)
                    </button>
                    <button
                      className={`block w-full text-left text-base px-2 py-2 rounded hover:bg-gray-800 ${!isDayMode ? "bg-gray-700" : ""}`}
                      onClick={() => setIsDayMode(false)}
                    >
                      กลางคืน (18:00 - 06:00)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* --- Satellite --- */}
          <div className="relative group">
            <div
              className="flex items-center px-3 py-2 rounded cursor-pointer transition hover:bg-gray-800"
              onClick={() => setIsSubMenuOpen(!isSubMenuOpen)}
            >
              <MdSatelliteAlt className="text-3xl" />
              {isSidebarOpen && (
                <>
                  <span className="ml-2 flex-1 text-lg">Satellite</span>
                  <span>
                    {isSubMenuOpen ? <FiChevronDown /> : <FiChevronRight />}
                  </span>
                </>
              )}
            </div>
            {!isSidebarOpen && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-black text-white px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap text-sm opacity-0 group-hover:opacity-100 transition-all duration-200 z-50">
              Satellite
            </div>
          )}

            {isSubMenuOpen && isSidebarOpen && (
              <div className="ml-8 mt-1 space-y-1 text-sm">
                <button className="block w-full text-left text-base px-2 py-2 rounded hover:bg-gray-800" 
                onClick={() => filterFeatures("all")}>
                  All
                </button>
                <button className="block w-full text-left text-base px-2 py-2 rounded hover:bg-gray-800"
                onClick={() => handleFilter("modis")}>
                  MODIS (bright_t31)
                </button>
                <button className="block w-full text-left text-base px-2 py-2 rounded hover:bg-gray-800"
                 onClick={() => filterFeatures("viirs_ti4")}>
                  VIIRS (bright_ti4)
                </button>
                <button className="block w-full text-left text-base px-2 py-2 rounded hover:bg-gray-800"
                onClick={() => filterFeatures("viirs_ti5")}>
                  VIIRS (bright_ti5)
                </button>
              </div>
            )}
          </div>



          {/* --- Rotate --- */}
          <div className="relative group">
            {!isSidebarOpen && (
              <div className="absolute left-24 top-2 opacity-0 group-hover:opacity-100 transition-opacity text-sm bg-black text-white px-2 py-1 rounded-md shadow-lg whitespace-nowrap z-40">
                Rotate 45°
              </div>
            )}
            <MenuItem
              icon={<MdCropRotate className="text-3xl" />}
              text="Rotate 45°"
              onClick={rotateMap}
              open={isSidebarOpen}
            />
          </div>
        </nav>
      </div>

            {/* --- Main Content --- */}
            <div className="flex-1 flex flex-col">
              {/* Header */}
              <header className="bg-white shadow px-6 py-4 text-2xl font-semibold border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* ปุ่มแฮมเบอร์เกอร์บนมือถือ */}
          <button
            className="md:hidden text-2xl "
            onClick={() => setIsSidebarOpen(true)}
          >
            <FiMenu />
          </button>

          <div className={`p-1 transition-all duration-300 ${isSidebarOpen ? "ml-60 md:ml-60" : "ml-0 md:ml-24"}`}
          >
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-gray-600 text-sm md:text-base">
              <FiMapPin className="text-xl text-gray-800" />
              <span>แผนที่</span>
              <span className="mx-1">/</span>
              <span className="text-gray-800 font-semibold">จุดความร้อน (ม.ค 67)</span>
            </div>
          </div>
        </div>
      </header>


        <main className="flex flex-col md:flex-row flex-1 relative">
          {/* แผนที่ฝั่งซ้าย */}
          <div
            ref={mapContainer}
            className="flex-1 min-h-[300px] bg-gray-100 relative"
          />

          {/* Sidebar ขวา */}
          <aside className="w-full md:w-96 bg-gray-100 px-4 py-6 border-l overflow-y-auto">
            {/* กล่อง 1: สรุปจุดความร้อนรายประเทศ */}
            <div className="bg-neutral-100 rounded-2xl shadow transition-transform hover:-translate-y-1 hover:shadow-xl mb-6">
              <div className="bg-black/60 text-white text-lg font-semibold px-6 py-3 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <FiGlobe className="text-white" />
                <span>สรุปจุดความร้อนรายประเทศ</span>
              </div>
              </div>
              <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                <svg
                  className="animate-spin h-4 w-4 text-gray-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  ></path>
                </svg>
                กำลังโหลดข้อมูล...
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {getFeatureCounts().map(([country, count]) => (
                    <div key={country} className="flex justify-between text-sm">
                      <span>{country}</span>
                      <span>{count} จุด</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-between font-medium text-sm border-t pt-3">
                  <span>รวม</span>
                  <span>{filteredFeatures.length} จุด</span>
                </div>
              </>
            )}
          </div>

            </div>

                {/* กล่อง 2: สรุประดับความร้อน */}
                <div className="bg-neutral-100 rounded-2xl shadow transition-transform hover:-translate-y-1 hover:shadow-xl">
                  {/* หัวกล่อง */}
                  <div className="bg-black/60 text-white text-lg font-semibold px-6 py-3 rounded-t-2xl">
                  <div className="flex items-center gap-2">
                      <FiPieChart className="text-white" />
                      <span>สรุประดับความร้อน</span>
                    </div>
                  </div>

                {/* เนื้อหากล่อง */}
                <div className="p-6">
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    {/* PieChart ซ้าย */}
                    <div className="w-full md:w-1/2 h-48 flex items-center justify-center">
                      {pieData.length > 0 && pieData.some((d) => d.value > 0) ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={60}
                          innerRadius={30}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-gray-500 text-sm">ไม่มีข้อมูลความร้อน</div>
                  )}
                </div>

                {/* รายการระดับความร้อน */}
                <div className="w-full md:w-1/2 space-y-2 text-sm text-gray-800">
                  {Object.entries(heatSummary).map(([label, count]) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="flex items-center">
                      <span
                            className="w-3 h-3 mr-2 rounded-full ring-2 ring-white"
                            style={{ backgroundColor: colorMap[label] }}
                          />
                        {label}
                      </span>
                      <span>{count} จุด</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* รายการประเภทที่ดินแนวนอน 2 คอลัมน์ */}
              <div className="w-full space-y-2 text-sm text-gray-800">
                <h4 className="text-base font-semibold text-gray-700 mb-2">ประเภทที่ดิน</h4>
                <div className="grid grid-cols-2 gap-3 ">
                  {Object.entries(landTypeSummary)
                    .filter(([type]) => type.trim() !== "-" && type.trim() !== "")
                    .map(([type, count]) => (
                      <div
                        key={type}
                        className="px-4 py-2 bg-neutral-200 rounded-full shadow transition-transform hover:-translate-y-1 text-sm font-medium flex justify-between items-center"
                      >
                        <span>{type}</span>
                        <span className="text-gray-500">{count} จุด</span>
                      </div>
                    ))}
                </div>
              </div>

            </div>
            
          </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

function MenuItem({ icon, text, onClick, open }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center px-3 py-2 rounded cursor-pointer transition hover:bg-gray-800"
    >
      {icon}
      {open && <span className="ml-2">{text}</span>}
    </div>
  );
}

export default MapDashboard;


