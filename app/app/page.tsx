"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Message = {
  user: string;
  text: string;
  avatar?: string;
  postal_code?: string;
  city?: string;
  room?: string;
};

type OnlineUser = {
  username: string;
  avatar: string;
  postalCode: string;
  city: string;
  age: string;
  gender: string;
};

type CitySuggestion = {
  nom: string;
  codesPostaux: string[];
};

export default function ChatPage() {
  const [entered, setEntered] = useState(false);
  const [username, setUsername] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("homme");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("tous");
  const [locationFilter, setLocationFilter] = useState("departement");
  const [room, setRoom] = useState("Accueil");
  const [loadingCities, setLoadingCities] = useState(false);

  const defaultAvatar = useMemo(
    () =>
      `https://api.dicebear.com/8.x/thumbs/svg?seed=${encodeURIComponent(
        username || "user"
      )}`,
    [username]
  );

  const rooms = [
    "Accueil",
    "Quizzz musik",
    "Quizzz",
    "18-20 ans",
    "20-30 ans",
    "30-40 ans",
    "40 ans et +",
    "Rencontres",
    "Discute sympa",
    "Coco Premium",
  ];

  const myDepartment = postalCode.slice(0, 2);

  useEffect(() => {
    if (!entered) return;

    fetchMessages();

    const channel = supabase
      .channel("messages-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((old) => [...old, newMessage]);
        }
      )
      .subscribe();

    const presenceChannel = supabase.channel("online-users", {
      config: { presence: { key: username } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();

        const users = Object.values(state)
          .flat()
          .map((u: any) => ({
            username: u.username,
            avatar: u.avatar,
            postalCode: u.postalCode,
            city: u.city,
            age: u.age,
            gender: u.gender,
          }))
          .filter((u) => u.username && u.username !== username);

        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            username,
            avatar: defaultAvatar,
            postalCode,
            city,
            age,
            gender,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [entered, username, defaultAvatar, postalCode, city, age, gender]);

  async function fetchMessages() {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erreur chargement messages:", error);
      return;
    }

    setMessages(data || []);
  }

  async function fetchCitiesByPostalCode(value: string) {
    const cleanValue = value.replace(/\D/g, "").slice(0, 5);

    setPostalCode(cleanValue);
    setCity("");
    setCitySuggestions([]);

    if (cleanValue.length !== 5) return;

    try {
      setLoadingCities(true);

      const res = await fetch(
        `https://geo.api.gouv.fr/communes?codePostal=${cleanValue}&fields=nom,codesPostaux&format=json`
      );

      const data: CitySuggestion[] = await res.json();
      setCitySuggestions(data);

      if (data.length === 1) {
        setCity(data[0].nom);
      }
    } catch (error) {
      console.error("Erreur récupération ville:", error);
      alert("Impossible de récupérer la ville pour ce code postal.");
    } finally {
      setLoadingCities(false);
    }
  }

  async function sendMessage() {
    if (!message.trim()) return;

    const { error } = await supabase.from("messages").insert([
      {
        user: username,
        text: message.trim(),
        avatar: defaultAvatar,
        postal_code: postalCode,
        city,
        room,
      },
    ]);

    if (error) {
      console.error("Erreur envoi message:", error);
      alert("Message non envoyé. Vérifie ta table Supabase.");
      return;
    }

    setMessage("");
  }

  function enterChat() {
    if (!username.trim() || !postalCode.trim() || !city.trim() || !age.trim()) {
      alert("Remplis pseudo, code postal, ville et âge.");
      return;
    }

    if (postalCode.length !== 5) {
      alert("Le code postal doit contenir 5 chiffres.");
      return;
    }

    if (Number(age) < 18) {
      alert("CocoLive est réservé aux +18 ans.");
      return;
    }

    setEntered(true);
  }

  const filteredMessages = messages.filter((msg) => {
    if (!msg.room) return room === "Accueil";
    return msg.room === room;
  });

  const filteredUsers = onlineUsers
    .filter((u) => {
      if (locationFilter === "ville") {
        return u.city?.toLowerCase() === city.toLowerCase();
      }

      return u.postalCode?.slice(0, 2) === myDepartment;
    })
    .filter((u) => (genderFilter === "tous" ? true : u.gender === genderFilter))
    .filter((u) => u.username.toLowerCase().includes(search.toLowerCase()));

  if (!entered) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-pink-950/50 to-black px-4 text-white">
        <div className="w-full max-w-md rounded-3xl border border-pink-500/40 bg-black/80 p-8 text-center shadow-2xl shadow-pink-500/20">
          <div className="mb-4 text-6xl">♂️💖♀️</div>
          <h1 className="mb-3 text-5xl font-black text-pink-500">COCOLIVE</h1>
          <p className="mb-6 text-gray-400">
            Rencontre, salons publics et tchat en direct près de chez toi.
          </p>

          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Pseudo..."
            className="mb-4 w-full rounded-full bg-white/10 px-5 py-3 outline-none focus:ring-2 focus:ring-pink-500"
          />

          <div className="mb-4 flex gap-3">
            <button
              onClick={() => setGender("homme")}
              className={`flex-1 rounded-full py-3 font-bold transition ${
                gender === "homme"
                  ? "bg-blue-500 text-white"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
            >
              ♂ Homme
            </button>

            <button
              onClick={() => setGender("femme")}
              className={`flex-1 rounded-full py-3 font-bold transition ${
                gender === "femme"
                  ? "bg-pink-500 text-black"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
            >
              ♀ Femme
            </button>
          </div>

          <input
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Âge..."
            type="number"
            min="18"
            className="mb-4 w-full rounded-full bg-white/10 px-5 py-3 outline-none focus:ring-2 focus:ring-pink-500"
          />

          <input
            value={postalCode}
            onChange={(e) => fetchCitiesByPostalCode(e.target.value)}
            placeholder="Code postal..."
            inputMode="numeric"
            maxLength={5}
            className="mb-3 w-full rounded-full bg-white/10 px-5 py-3 outline-none focus:ring-2 focus:ring-pink-500"
          />

          {loadingCities && <p className="mb-3 text-sm text-pink-300">Recherche de ta ville...</p>}

          {citySuggestions.length > 1 && (
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mb-4 w-full rounded-full bg-white/10 px-5 py-3 outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="" className="bg-black">Choisis ta ville</option>
              {citySuggestions.map((c) => (
                <option key={c.nom} value={c.nom} className="bg-black">
                  {c.nom}
                </option>
              ))}
            </select>
          )}

          {city && (
            <p className="mb-4 rounded-full bg-pink-500/10 px-4 py-2 text-sm text-pink-300">
              📍 Ville détectée : <span className="font-bold">{city}</span>
            </p>
          )}

          <button
            onClick={enterChat}
            className="w-full rounded-full bg-pink-500 px-6 py-3 font-black text-black transition hover:bg-pink-400"
          >
            Entrer sur CocoLive
          </button>

          <p className="mt-4 text-xs text-gray-500">🔞 18+ uniquement • Modération active</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen bg-black text-white">
      <aside className="hidden w-72 border-r border-pink-500/20 bg-black/60 p-4 lg:block">
        <h1 className="mb-6 text-3xl font-black text-pink-500">💖 COCOLIVE</h1>

        <div className="mb-4 rounded-2xl border border-pink-500/20 bg-white/10 p-4">
          <p className="text-sm text-gray-400">Pseudo : {username}</p>
          <p className="text-sm text-gray-400">Genre : {gender}</p>
          <p className="text-sm text-gray-400">Âge : {age}</p>
          <p className="text-sm text-gray-400">Ville : {city}</p>
          <p className="text-sm text-gray-400">Département : {myDepartment}</p>
        </div>

        <h2 className="mb-3 font-black text-pink-400">Liste des salons publics</h2>

        <div className="space-y-2">
          {rooms.map((r) => (
            <button
              key={r}
              onClick={() => setRoom(r)}
              className={`flex w-full justify-between rounded-xl px-4 py-3 text-left text-sm transition ${
                room === r ? "bg-pink-500 text-black" : "bg-white/10 hover:bg-pink-500/20"
              }`}
            >
              <span>{r}</span>
              <span>{r === room ? filteredMessages.length : "•"}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-pink-500/20 p-4">
          <div>
            <h2 className="text-2xl font-black text-pink-500">{room}</h2>
            <p className="text-sm text-gray-400">Connecté : {username} • {city} • Département {myDepartment}</p>
          </div>

          <button className="rounded-full bg-white/10 px-4 py-2 text-sm transition hover:bg-pink-500/20">
            Profil
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {filteredMessages.length === 0 && (
            <div className="rounded-2xl border border-pink-500/20 bg-white/5 p-5 text-center text-gray-400">
              Aucun message dans ce salon. Sois le premier à écrire 🔥
            </div>
          )}

          {filteredMessages.map((msg, i) => (
            <div key={i} className="rounded-2xl bg-white/10 p-3">
              <div className="mb-1 flex items-center gap-2">
                {msg.avatar && <img src={msg.avatar} alt="avatar" className="h-8 w-8 rounded-full object-cover" />}
                <div>
                  <p className="font-bold text-pink-400">{msg.user}</p>
                  <p className="text-xs text-gray-500">{msg.city || "Ville inconnue"} • dep {msg.postal_code?.slice(0, 2) || "--"}</p>
                </div>
              </div>
              <p>{msg.text}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 border-t border-pink-500/20 p-4">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            placeholder={`Écris dans ${room}...`}
            className="flex-1 rounded-full bg-white/10 px-5 py-3 outline-none focus:ring-2 focus:ring-pink-500"
          />

          <button onClick={sendMessage} className="rounded-full bg-pink-500 px-6 py-3 font-black text-black transition hover:bg-pink-400">
            ➤
          </button>
        </div>
      </section>

      <aside className="hidden w-80 border-l border-pink-500/20 bg-black/60 p-4 md:block">
        <h2 className="mb-4 text-xl font-black text-pink-500">👥 Connectés</h2>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un pseudo..."
          className="mb-3 w-full rounded-full bg-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-pink-500"
        />

        <div className="mb-3 flex gap-2">
          <button onClick={() => setGenderFilter("tous")} className={`flex-1 rounded-full py-2 text-sm transition ${genderFilter === "tous" ? "bg-pink-500 text-black" : "bg-white/10"}`}>Tous</button>
          <button onClick={() => setGenderFilter("homme")} className={`flex-1 rounded-full py-2 text-sm transition ${genderFilter === "homme" ? "bg-blue-500 text-white" : "bg-white/10"}`}>♂</button>
          <button onClick={() => setGenderFilter("femme")} className={`flex-1 rounded-full py-2 text-sm transition ${genderFilter === "femme" ? "bg-pink-500 text-black" : "bg-white/10"}`}>♀</button>
        </div>

        <div className="mb-4 flex gap-2">
          <button onClick={() => setLocationFilter("departement")} className={`flex-1 rounded-full py-2 text-xs transition ${locationFilter === "departement" ? "bg-pink-500 text-black" : "bg-white/10"}`}>Mon dep</button>
          <button onClick={() => setLocationFilter("ville")} className={`flex-1 rounded-full py-2 text-xs transition ${locationFilter === "ville" ? "bg-pink-500 text-black" : "bg-white/10"}`}>Ma ville</button>
        </div>

        <p className="mb-4 text-sm text-gray-400">
          {filteredUsers.length} utilisateur(s) connecté(s) {locationFilter === "ville" ? `à ${city}` : `dans le département ${myDepartment}`}
        </p>

        <div className="space-y-3">
          {filteredUsers.length === 0 && (
            <div className="rounded-2xl border border-pink-500/20 bg-white/5 p-4 text-sm text-gray-400">
              Aucun connecté trouvé autour de toi pour le moment.
            </div>
          )}

          {filteredUsers.map((user, i) => (
            <div key={`${user.username}-${i}`} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 transition hover:bg-pink-500/20">
              <img src={user.avatar} alt="avatar" className="h-10 w-10 rounded-full object-cover" />
              <div>
                <p className="font-bold">{user.gender === "femme" ? "♀" : "♂"} {user.username}</p>
                <p className="text-xs text-gray-400">{user.age} ans • {user.city} • dep {user.postalCode?.slice(0, 2)}</p>
                <p className="text-xs text-green-400">● en ligne</p>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </main>
  );
}
