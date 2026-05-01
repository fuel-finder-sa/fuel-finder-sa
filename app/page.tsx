"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
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
  const [priceSubmissions,setPriceSubmissions]=useState<any[]>([]);
  const [search,setSearch]=useState("");
  const [province,setProvince]=useState("All");
  const [truckMode,setTruckMode]=useState(false);
  const [open24,setOpen24]=useState(false);
  const [userLocation,setUserLocation]=useState<any>(null);

  const [showAddForm,setShowAddForm]=useState(false);
  const [showReportForm,setShowReportForm]=useState(false);
  const [showUpdateForm,setShowUpdateForm]=useState(false);
  const [selectedStation,setSelectedStation]=useState<any>(null);

  const [newStation,setNewStation]=useState({
    name:"",
    location:"",
    diesel50:"",
    petrol93:"",
    petrol95:"",
  });

  const [fuelType,setFuelType]=useState("diesel50");
  const [newPrice,setNewPrice]=useState("");

  const isAdmin =
    typeof window !== "undefined" &&
    window.location.search.includes("admin=true");

  useEffect(()=>{
    async function fetchData(){

      const snap=await getDocs(collection(db,"stations"));
      setStations(snap.docs.map(d=>({id:d.id,...d.data()})));

      if(isAdmin){
        const priceSnap=await getDocs(collection(db,"priceUpdates"));
        setPriceSubmissions(priceSnap.docs.map(d=>({id:d.id,...d.data()})));
      }

      navigator.geolocation?.getCurrentPosition(pos=>{
        setUserLocation({
          lat:pos.coords.latitude,
          lng:pos.coords.longitude
        });
      });

    }

    fetchData();
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
    setShowAddForm(false);
  }

  async function submitPrice(){
    await addDoc(collection(db,"priceUpdates"),{
      stationId:selectedStation.id,
      stationName:selectedStation.name,
      fuelType,
      newPrice:Number(newPrice),
      createdAt:serverTimestamp()
    });
    alert("Submitted");
    setShowUpdateForm(false);
  }

  async function approvePrice(p:any){

    await updateDoc(doc(db,"stations",p.stationId),{
      [p.fuelType]:p.newPrice
    });

    await deleteDoc(doc(db,"priceUpdates",p.id));

    alert("Approved & Live ✔");

    location.reload();
  }

  const filtered=stations
    .filter(s=>{
      const txt=`${s.name} ${s.city||""}`.toLowerCase();
      return txt.includes(search.toLowerCase());
    })
    .map(s=>{
      const distance=userLocation&&s.lat&&s.lng?
        getDistanceKm(userLocation.lat,userLocation.lng,s.lat,s.lng):null;
      return {...s,distance};
    });

  return(

    <main style={{maxWidth:520,margin:"0 auto",padding:14}}>

      <h2>Fuel Finder SA</h2>

      <button onClick={()=>setShowAddForm(true)}>➕ Add Station</button>

      <input placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} />

      {/* ADMIN PANEL */}
      {isAdmin && (
        <div style={{background:"#111827",color:"white",padding:10,marginTop:10}}>
          <h3>Pending Price Updates</h3>

          {priceSubmissions.map(p=>(
            <div key={p.id} style={{marginTop:8}}>
              {p.stationName} - R{p.newPrice}
              <button onClick={()=>approvePrice(p)}>Approve</button>
            </div>
          ))}
        </div>
      )}

      {/* LIST */}
      {filtered.map(s=>(
        <div key={s.id} style={{background:"white",padding:10,marginTop:10}}>

          <b>{s.name}</b>
          <div>Diesel: R{s.diesel50}</div>

          <button onClick={()=>{
            setSelectedStation(s);
            setShowUpdateForm(true);
          }}>
            💸 Update Price
          </button>

        </div>
      ))}

      {/* UPDATE MODAL */}
      {showUpdateForm && (
        <div style={{background:"white",padding:20,marginTop:20}}>
          <h3>Update Price</h3>

          <select onChange={e=>setFuelType(e.target.value)}>
            <option value="diesel50">Diesel</option>
            <option value="petrol93">Petrol 93</option>
            <option value="petrol95">Petrol 95</option>
          </select>

          <input
            placeholder="New Price"
            value={newPrice}
            onChange={e=>setNewPrice(e.target.value)}
          />

          <button onClick={submitPrice}>Submit</button>
        </div>
      )}

    </main>
  );
}