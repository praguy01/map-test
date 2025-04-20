import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {MdSatelliteAlt,MdCropRotate,MdAccessTimeFilled} from "react-icons/md";
import {FaChevronRight,FaChevronLeft} from "react-icons/fa";
import {FiChevronLeft,FiChevronRight,FiChevronDown,FiMenu,FiMapPin,FiGlobe ,FiPieChart} from "react-icons/fi";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

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


  const filterFeatures = (type) => {
    switch (type) {
      case "all":
        setFeatures(allFeatures);
        break;
      case "modis":
        setFeatures(allFeatures.filter((f) => f.properties.bright_t31 !== null));
        break;
      case "viirs_ti4":
        setFeatures(allFeatures.filter((f) => f.properties.bright_ti4 !== null));
        break;
      case "viirs_ti5":
        setFeatures(allFeatures.filter((f) => f.properties.bright_ti5 !== null));
        break;
      default:
        setFeatures(allFeatures);
    }
  };  

  const filterByTime = (features, isDayMode) => {
    return features.filter((f) => {
      const timeStr = f.properties?.th_time;
      if (!timeStr || timeStr.length !== 4) return false;
      const hour = parseInt(timeStr.slice(0, 2), 10);
      return isDayMode ? hour >= 6 && hour < 18 : hour < 6 || hour >= 18;
    });
  };
  
  const [heatSummary, setHeatSummary] = useState({
    "ร้อนมาก": 0,
    "ร้อนสูง": 0,
    "ร้อนปานกลาง": 0,
    "ปกติ": 0,
  });

  const colorMap = {
    "ร้อนมาก": "#ef4444",      // red-500
    "ร้อนสูง": "#fb923c",      // orange-400
    "ร้อนปานกลาง": "#fde047", // yellow-300
    "ปกติ": "#d1d5db",         // gray-300
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
            f.properties?.bright_t31 ??
            f.properties?.bright_ti4 ??
            f.properties?.bright_ti5 ??
            0,
          satellite: f.properties?.satellite || null,
          th_date: f.properties?.th_date || null,
          th_time: f.properties?.th_time || null,
        },
      })),
  });
  
  


  useEffect(() => {
    const url =
      "https://v2k-dev.vallarismaps.com/core/api/features/1.1/collections/658cd4f88a4811f10a47cea7/items?api_key=bLNytlxTHZINWGt1GIRQBUaIlqz9X45XykLD83UkzIoN6PFgqbH7M7EDbsdgKVwC";
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.features) {
          console.log("ดึงข้อมูล features", data.features.length);
          setAllFeatures(data.features); // ต้องเก็บลง allFeatures
          setFeatures(data.features);

          // ดึงเวลาจาก feature แรก
        const timeString = data.features[0]?.properties?.th_time;
        if (timeString) {
          const hour = parseInt(timeString.slice(0, 2), 10);

          // สมมติ กลางวันคือ 6:00 - 17:59
          const isDay = hour >= 6 && hour < 18;
          setTimePeriod(isDay ? "day" : "night");
        }
      }
    });
  }, []);

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
  
    const filteredFeatures = filterByTime(features, isDayMode);
    const summary = {
      "ร้อนมาก": 0,
      "ร้อนสูง": 0,
      "ร้อนปานกลาง": 0,
      "ปกติ": 0,
    };
    
    filteredFeatures.forEach((feature) => {
      const brightness =
        feature.properties.brightness ??
        feature.properties.bright_t31 ??
        feature.properties.bright_ti4 ??
        feature.properties.bright_ti5 ??
        0;
    
      if (brightness > 320) summary["ร้อนมาก"]++;
      else if (brightness > 310) summary["ร้อนสูง"]++;
      else if (brightness >= 295) summary["ร้อนปานกลาง"]++;
      else summary["ปกติ"]++;
    });
    
    setHeatSummary(summary); // set ค่าเข้า state
    
    const geojson = getHeatmapGeoJSON(filteredFeatures);
  
    if (mapRef.current.getSource("heat")) {
      mapRef.current.getSource("heat").setData(geojson);
    } else {
      mapRef.current.addSource("heat", {
        type: "geojson",
        data: geojson,
      });
  
      //  Heatmap Layer
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
            0, 0,
            100, 1,
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
  
      //  Circle layer (โปร่งใสไว้คลิก)
      mapRef.current.addLayer({
        id: "heatmap-point-layer",
        type: "circle",
        source: "heat",
        minzoom: 5,
        paint: {
          "circle-radius": 6,
          "circle-color": "#fff",
          "circle-opacity": 0.01, // มองไม่เห็น แต่คลิกได้
        },
      });
  
      // Popup เมื่อคลิกจุด
      mapRef.current.on("click", "heatmap-point-layer", (e) => {
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
      
        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
          <div style="font-size: 14px; line-height: 1.5;">
            <strong></strong> ${formattedDate}<br/>
            <strong>🛰️ ดาวเทียม:</strong> ${props.satellite || "-"}<br/>
            <strong>🔥 ความร้อน:</strong> ${props.intensity || "-"}<br/>
            <strong>📍 ลองจิจูด:</strong> ${coords[0].toFixed(4)}
          </div>
        `);
      
        popup.setLngLat(coords).addTo(mapRef.current);
      });
    }
  
    //  Fit map to bounds
    const bounds = new maplibregl.LngLatBounds();
    filteredFeatures.forEach((f) => {
      const coords = f.geometry?.coordinates;
      if (coords) bounds.extend(coords);
    });
  
    if (!bounds.isEmpty()) {
      const featureCount = filteredFeatures.length;
    
      if (featureCount === 1) {
        const coords = filteredFeatures[0].geometry.coordinates;
        mapRef.current.setCenter(coords);
        mapRef.current.setZoom(6); 
      } else {
        mapRef.current.fitBounds(bounds, { padding: 40, maxZoom: 8 }); // จำกัดไม่ให้ zoom ใกล้เกิน
      }
    }
  }, [features, isDayMode]);
  
  

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

  const getFeatureCounts = () => {
    // สมมติว่าใช้ 'ct_tn' (ชื่อประเทศในภาษาไทย) หรือ 'ct_en' (ชื่อประเทศในภาษาอังกฤษ)
    const countryCounts = features.reduce((acc, feature) => {
      const country = feature.properties?.ct_tn || feature.properties?.ct_en || "ไม่ระบุ"; // ใช้ ct_tn ถ้ามี, ถ้าไม่มีก็ใช้ ct_en
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {});
  
    // แปลงเป็น array ของ [category, count] สำหรับการแสดงผล
    return Object.entries(countryCounts);
  };

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
  
  

  return (
    <div className="flex h-screen overflow-hidden overflow-y-auto">
      {/* --- Sidebar --- */}
      <div
          className={`fixed md:static top-0 left-0 h-full bg-black/85 text-white flex flex-col z-40 transition-all duration-300 ease-in-out
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
                onClick={() => filterFeatures("modis")}>
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
                  <span className="ml-2 flex-1 text-lg">Time</span>
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
              <label className="relative inline-block w-14 h-8 left-10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDayMode}
                  onChange={() => setIsDayMode(!isDayMode)}
                  className="sr-only peer"
                />
                <div className="w-full h-full bg-gray-300 rounded-full peer-checked:bg-white transition-colors duration-300" />
                <div
                  className="absolute top-0.5 left-0.5 w-7 h-7 bg-white rounded-full shadow-md flex items-center justify-center text-lg transition-transform duration-300 peer-checked:translate-x-6"
                >
                  {isDayMode ? "☀️" : "🌙"}
                </div>
                {/* แสดงข้อความใต้ toggle */}
                <p className="text-base mt-2 text-white">
                  {isDayMode ? "กลางวัน" : "กลางคืน"}
                </p>
              </label>
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
      className="md:hidden text-2xl"
      onClick={() => setIsSidebarOpen(true)}
    >
      <FiMenu />
    </button>

    {/* Breadcrumb + ไอคอน */}
    <div className="flex items-center gap-3 text-gray-600 text-sm md:text-base">
      <FiMapPin className="text-xl text-gray-800" />
      <span>แผนที่</span>
      <span className="mx-1">/</span>
      <span className="text-gray-800 font-semibold">
        จุดความร้อน (7 ม.ค. 2567)
      </span>
    </div>
  </div>
</header>


        <main className="flex flex-col md:flex-row flex-1 relative">
          {/* แผนที่ฝั่งซ้าย */}
          <div
            ref={mapContainer}
            className="flex-1 min-h-[320px] bg-gray-100 relative"
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
                  <span>{features.length} จุด</span>
                </div>
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


