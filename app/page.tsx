"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

function getDistanceKm(lat1:number,lng1:number,lat2:number,lng2:number){
  const R=6371;
  const dLat=((lat2-lat1)*Math.PI)/180;
  const dLng=((lng2-lng1)*Math.PI)/180;
  const a=Math.sin(dLat/2)**2+
    Math.cos(lat1*Math.PI/180)*
    Math.cos(lat2*Math.PI/180)*
    Math.sin(dLng/2)**2;
  return R*(2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}

export default function Home(){
  const [stations,setStations]=useState<any[]>([]);
  const [search,setSearch]=useState("");
  const [province,setProvince]=useState("All");
  const [truckMode,setTruckMode]=useState(false);
  const [open24,setOpen24]=useState(false);
  const [userLocation,setUserLocation]=useState<any>(null);

  const [showForm,setShowForm]=useState(false);
  const [newStation,setNewStation]=useState({
    name:"",
    location:"",
    diesel50:"",
    petrol93:"",
    petrol95:""
  });

  useEffect(()=>{
    async function fetch(){
      const snap=await getDocs(collection(db,"stations"));
      setStations(snap.docs.map(d=>({id:d.id,...d.data()})));
    }
    fetch();

    navigator.geolocation?.getCurrentPosition(pos=>{
      setUserLocation({
        lat:pos.coords.latitude,
        lng:pos.coords.longitude
      });
    });
  },[]);

  async function submitStation(){
    if(!newStation.name||!newStation.location){
      alert("Fill name & location");
      return;
    }

    await addDoc(collection(db,"stationSubmissions"),{
      ...newStation,
      diesel50:Number(newStation.diesel50),
      petrol93:Number(newStation.petrol93),
      petrol95:Number(newStation.petrol95),
      createdAt:serverTimestamp()
    });

    alert("Submitted 👍");
    setShowForm(false);
  }

  async function reportFuelIssue(s:any){
    await addDoc(collection(db,"reports"),{
      stationName:s.name,
      type:"OUT_OF_FUEL",
      createdAt:serverTimestamp()
    });
    alert("Reported");
  }

  async function updateFuelPrice(s:any){
    const type=prompt("diesel50 / petrol93 / petrol95");
    if(!type)return;
    const val=prompt("Enter price");
    if(!val)return;

    await addDoc(collection(db,"priceUpdates"),{
      stationName:s.name,
      fuelType:type,
      newPrice:Number(val),
      createdAt:serverTimestamp()
    });

    alert("Updated");
  }

  const provinces=["All",...new Set(stations.map(s=>s.province).filter(Boolean))];

  const filtered=stations
    .filter(s=>{
      const txt=`${s.name} ${s.city||""} ${s.province||""}`.toLowerCase();
      return txt.includes(search.toLowerCase()) &&
        (province==="All"||s.province===province)&&
        (!truckMode||s.truckFriendly)&&
        (!open24||s.open24Hours);
    })
    .map(s=>{
      const distance=userLocation&&s.lat&&s.lng?
        getDistanceKm(userLocation.lat,userLocation.lng,s.lat,s.lng):null;
      return {...s,distance};
    })
    .sort((a,b)=>(a.diesel50??999)-(b.diesel50??999));

  return(
    <main style={{maxWidth:520,margin:"0 auto",padding:14,background:"#f8fafc"}}>

      {/* HEADER */}
      <div style={{
        background:"linear-gradient(135deg,#0f172a,#1e293b)",
        color:"white",
        padding:20,
        borderRadius:22
      }}>
        <h2>Fuel Finder SA</h2>
        <p>Find cheapest & safest fuel stops.</p>

        <div style={{display:"flex",gap:10}}>
          <button
            onClick={()=>navigator.geolocation.getCurrentPosition(pos=>{
              setUserLocation({lat:pos.coords.latitude,lng:pos.coords.longitude});
            })}
            style={{background:"#22c55e",color:"white",padding:10,borderRadius:12}}
          >
            📍 Use My Location
          </button>

          <button
            onClick={()=>setShowForm(!showForm)}
            style={{background:"#f59e0b",color:"white",padding:10,borderRadius:12}}
          >
            ➕ Add Station
          </button>
        </div>
      </div>

      {/* FORM */}
      {showForm&&(
        <div style={{background:"white",padding:12,marginTop:10,borderRadius:12}}>
          <input placeholder="Name" onChange={e=>setNewStation({...newStation,name:e.target.value})}/>
          <input placeholder="Location" onChange={e=>setNewStation({...newStation,location:e.target.value})}/>
          <input placeholder="Diesel" onChange={e=>setNewStation({...newStation,diesel50:e.target.value})}/>
          <input placeholder="P93" onChange={e=>setNewStation({...newStation,petrol93:e.target.value})}/>
          <input placeholder="P95" onChange={e=>setNewStation({...newStation,petrol95:e.target.value})}/>

          <button onClick={submitStation} style={{background:"#059669",color:"white",padding:10}}>
            Submit
          </button>
        </div>
      )}

      {/* FILTERS */}
      <select value={province} onChange={e=>setProvince(e.target.value)}>
        {provinces.map(p=><option key={p}>{p}</option>)}
      </select>

      <label><input type="checkbox" onChange={()=>setTruckMode(!truckMode)}/> Truck</label>
      <label><input type="checkbox" onChange={()=>setOpen24(!open24)}/> 24h</label>

      <input placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} />

      {/* BEST */}
      {filtered[0]&&(
        <div style={{background:"#111827",color:"white",padding:12,borderRadius:12,marginTop:10}}>
          🔥 BEST OPTION
          <div>{filtered[0].name}</div>
          💸 R{filtered[0].diesel50}
          {filtered[0].distance&&<div>📍 {filtered[0].distance.toFixed(1)} km</div>}
        </div>
      )}

      {/* LIST */}
      {filtered.map(s=>(
        <div key={s.id} style={{background:"white",padding:12,marginTop:10,borderRadius:12}}>
          <b>{s.name}</b>

          <div>
            Diesel: R{s.diesel50} | Petrol 93: R{s.petrol93} | Petrol 95: R{s.petrol95}
          </div>

          {s.distance&&<div>📍 {s.distance.toFixed(1)} km</div>}

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            <button onClick={()=>window.open(`https://maps.google.com?q=${s.lat},${s.lng}`)}>🧭 Navigate</button>
            <a href={`tel:${s.phoneNumber}`}><button>📞 Call</button></a>
            <button onClick={()=>reportFuelIssue(s)}>⚠️ Report</button>
            <button onClick={()=>updateFuelPrice(s)}>💸 Update</button>
          </div>
        </div>
      ))}
    </main>
  );
}