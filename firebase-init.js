// Capa de datos en la nube (reemplaza server.js de la spec por Firestore).
// Respeta el contrato srv*: addResult, getResults, subscribe, clear.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot,
         query, orderBy, serverTimestamp, deleteDoc, doc }
  from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB2Rk5gmQXaqKq_uZTs_eNEG94JYxv9IOs",
  authDomain: "reto-cardiometabolica.firebaseapp.com",
  projectId: "reto-cardiometabolica",
  storageBucket: "reto-cardiometabolica.firebasestorage.app",
  messagingSenderId: "799220590813",
  appId: "1:799220590813:web:2267884665e118f6789334"
};

let db=null, ready=false;
try{
  const app=initializeApp(firebaseConfig);
  db=getFirestore(app);
  ready=true;
}catch(e){ console.warn("Firebase no disponible:",e); }

const COL="desafio_resultados";

// Expone la capa srv* global que game.js consume
window.SRV = {
  available(){ return ready; },
  async addResult(r){
    if(!ready) return false;
    try{ await addDoc(collection(db,COL),{...r, creado:serverTimestamp()}); return true; }
    catch(e){ console.warn("srvAdd fail",e); return false; }
  },
  async getResults(){
    if(!ready) return null;
    try{
      const snap=await getDocs(query(collection(db,COL),orderBy("total","desc")));
      const rows=[]; snap.forEach(d=>rows.push({_id:d.id,...d.data()})); return rows;
    }catch(e){ console.warn("srvGet fail",e); return null; }
  },
  subscribe(cb){
    if(!ready) return ()=>{};
    const q=query(collection(db,COL),orderBy("total","desc"));
    return onSnapshot(q,snap=>{
      const rows=[]; snap.forEach(d=>rows.push({_id:d.id,...d.data()})); cb(rows);
    },err=>console.warn("subscribe err",err));
  },
  async clear(){
    if(!ready) return false;
    try{
      const snap=await getDocs(collection(db,COL));
      const dels=[]; snap.forEach(d=>dels.push(deleteDoc(doc(db,COL,d.id))));
      await Promise.all(dels); return true;
    }catch(e){ console.warn("srvClear fail",e); return false; }
  }
};
window.dispatchEvent(new Event("srv-ready"));
