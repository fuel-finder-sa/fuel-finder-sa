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
      setUserLocation({lat:pos.coords.latitude,lng:pos.coords.longitude});
    });
  },[]);

  async function submitStation(){
    await addDoc(collection(db,"stationSubmissions"),{
      ...newStation,
      diesel50:Number(newStation.diesel50),
      petrol93:Number(newStation.petrol93),
      petrol95:Number(newStation.petrol95),
      createdAt:serverTimestamp()
    });
    alert("Submitted");
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
    const val=prompt("New diesel price?");
    if(!val)return;
    await addDoc(collection(db,"priceUpdates"),{
      stationName:s.name,
      newPrice:Number(val),
      createdAt:serverTimestamp()
    });
    alert("Updated");
  }

  const provinces=["All",...new Set(stations.map(s=>s.province).filter(Boolean))];

  const filtered=stations
    .filter(s=>{
      const txt=`${s.name} ${s.city||""}`.toLowerCase();
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

    <main style={{maxWidth:520,margin:"0 auto",padding:14,background:"#f1f5f9"}}>

      {/* HEADER */}
      <div style={{
        background:"#0f172a",
        color:"white",
        padding:18,
        borderRadius:20,
        marginBottom:12
      }}>
        <h2 style={{margin:0}}>Fuel Finder</h2>

        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button onClick={()=>setShowForm(true)}
            style={{flex:1,padding:12,borderRadius:12,background:"#f59e0b",color:"white"}}>
            ➕ Add
          </button>

          <button onClick={()=>navigator.geolocation.getCurrentPosition(pos=>{
            setUserLocation({lat:pos.coords.latitude,lng:pos.coords.longitude});
          })}
            style={{flex:1,padding:12,borderRadius:12,background:"#22c55e",color:"white"}}>
            📍 Locate
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div style={{background:"white",padding:12,borderRadius:14,marginBottom:10}}>
        <select value={province} onChange={e=>setProvince(e.target.value)}
          style={{width:"100%",padding:10,borderRadius:10}}>
          {provinces.map(p=><option key={p}>{p}</option>)}
        </select>

        <div style={{display:"flex",gap:10,marginTop:10}}>
          <button onClick={()=>setTruckMode(!truckMode)}
            style={{flex:1,padding:10,borderRadius:10,background:truckMode?"#22c55e":"#e5e7eb"}}>
            🚛 Truck
          </button>

          <button onClick={()=>setOpen24(!open24)}
            style={{flex:1,padding:10,borderRadius:10,background:open24?"#22c55e":"#e5e7eb"}}>
            🕒 24h
          </button>
        </div>
      </div>

      {/* SEARCH */}
      <input
        placeholder="Search..."
        value={search}
        onChange={e=>setSearch(e.target.value)}
        style={{width:"100%",padding:12,borderRadius:12,marginBottom:10}}
      />

      {/* LIST */}
      {filtered.map(s=>(
        <div key={s.id} style={{
          background:"white",
          padding:14,
          marginBottom:10,
          borderRadius:14,
          boxShadow:"0 4px 10px rgba(0,0,0,0.05)"
        }}>
          <b>{s.name}</b>

          <div style={{marginTop:4}}>
            💸 R{s.diesel50}
            {s.distance&&<span> • 📍 {s.distance.toFixed(1)}km</span>}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:10}}>
            <button onClick={()=>window.open(`https://maps.google.com?q=${s.lat},${s.lng}`)}>
              🧭 Navigate
            </button>
            <button onClick={()=>reportFuelIssue(s)}>⚠️ Report</button>
            <button onClick={()=>updateFuelPrice(s)}>💸 Update</button>
            <a href={`tel:${s.phoneNumber}`}><button>📞 Call</button></a>
          </div>
        </div>
      ))}

    </main>
  );
}