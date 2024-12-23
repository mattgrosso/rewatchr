import './App.scss';
import 'bootstrap/dist/css/bootstrap.min.css';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { ref, push, onValue } from 'firebase/database';
import { useState, useEffect } from 'react';
import { database, auth } from './firebase';

function App() {
  const [user, setUser] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [suggestedEpisode, setSuggestedEpisode] = useState(null);

  useEffect(() => {
    if (user) {
      const sanitizedDisplayName = user.displayName.replace(/\s+/g, '_').toLowerCase();
      const episodesRef = ref(database, `users/${user.uid}_${sanitizedDisplayName}/episodes`);
      onValue(episodesRef, (snapshot) => {
        const data = snapshot.val();
        setEpisodes(data ? Object.values(data) : []);
      });
    }
  }, [user]);

  const handleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
      .then((result) => {
        setUser(result.user);
      })
      .catch((error) => {
        console.error(error);
      });
  };

  const handleAddEpisode = () => {
    const episode = prompt("Enter episode name and where to watch:");
    if (episode) {
      const sanitizedDisplayName = user.displayName.replace(/\s+/g, '_').toLowerCase();
      const episodesRef = ref(database, `users/${user.uid}_${sanitizedDisplayName}/episodes`);
      push(episodesRef, { name: episode, watched: false });
    }
  };

  const handleSuggestEpisode = () => {
    const unwatchedEpisodes = episodes.filter(episode => !episode.watched);
    if (unwatchedEpisodes.length > 0) {
      const randomEpisode = unwatchedEpisodes[Math.floor(Math.random() * unwatchedEpisodes.length)];
      setSuggestedEpisode(randomEpisode);
    } else {
      alert("No unwatched episodes available.");
    }
  };

  return (
    <div className="rewatchr-app container">
      {!user ? (
        <button className="btn btn-primary" onClick={handleLogin}>Login with Google</button>
      ) : (
        <>
          <button className="btn btn-success" onClick={handleAddEpisode}>Add Episode</button>
          <button className="btn btn-info" onClick={handleSuggestEpisode}>Suggest Episode</button>
          {suggestedEpisode && <div className="alert alert-info mt-3">Watch: {suggestedEpisode.name}</div>}
        </>
      )}
    </div>
  );
}

export default App;
