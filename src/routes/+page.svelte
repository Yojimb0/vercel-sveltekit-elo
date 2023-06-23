<script>
  import { onMount } from "svelte";

  // Import the Firebase SDK and initialize the Firestore database
  import { initializeApp } from 'firebase/app';
  import { getFirestore, collection, getDocs, addDoc, query, where, limit } from 'firebase/firestore/lite';
  import { onSnapshot, doc, updateDoc } from "firebase/firestore";

  const firebaseConfig = {
  apiKey: "AIzaSyCBOYHYzC2DYlk2OUT8QDCI_19RJcoqYjk",
  authDomain: "vercel-sveltkit-elo.firebaseapp.com",
  projectId: "vercel-sveltkit-elo",
  storageBucket: "vercel-sveltkit-elo.appspot.com",
  messagingSenderId: "117068038321",
  appId: "1:117068038321:web:706d5d7afc274d47446290"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

  let winnerName = "";
  let loserName = "";

  const createPlayerIfNotExists = async (playerName) => {
    // Check if the player already exists in the "players" collection
    const playersRef = collection(db, "players");
    const q = query(playersRef, where("name", "==", playerName), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // Player does not exist, create a new document in the "players" collection
      await addDoc(playersRef, { name: playerName, eloScore: 1000 });
      console.log("New player created:", playerName);
    }
  };

  const handleSubmit = async () => {
    try {
      // Store the winner and loser names in the "names" collection of Firestore
      await addDoc(collection(db, "names"), {
        winner: winnerName,
        loser: loserName,
      });

	  createPlayerIfNotExists(winnerName);
	  createPlayerIfNotExists(loserName)

      // Reset the input fields
      winnerName = "";
      loserName = "";

      // Display a success message or perform any other action
      console.log("Names stored successfully!");

	  updateEloScores();
    } catch (error) {
      console.error("Error storing names:", error);
    }
  };

  let playerStats = [];

  const calculateElo = (winnerScore, loserScore, kFactor) => {
    const expectedScoreWinner = 1 / (1 + 10 ** ((loserScore - winnerScore) / 400));
    const expectedScoreLoser = 1 - expectedScoreWinner;

    const updatedWinnerScore = winnerScore + kFactor * (1 - expectedScoreWinner);
    const updatedLoserScore = loserScore + kFactor * (0 - expectedScoreLoser);

    return { updatedWinnerScore, updatedLoserScore };
  };

  const updateEloScores = async () => {
    try {
      // Retrieve the matches from the "names" collection
      const matchesSnapshot = await getDocs(collection(db, "names"));
      const matches = matchesSnapshot.docs.map((doc) => doc.data());

      // Retrieve the players from the "players" collection
      const playersSnapshot = await getDocs(collection(db, "players"));
      const players = playersSnapshot.docs.map((doc) => doc.data());

      // Calculate and update the ELO scores for each player
      const updatedPlayers = players.map((player) => {
        let { eloScore } = player;

        for (const match of matches) {
          if (match.winner === player.name) {
            const loser = players.find((p) => p.name === match.loser);
            const { updatedWinnerScore } = calculateElo(eloScore, loser?.eloScore, 32);
            eloScore = updatedWinnerScore;
          } else if (match.loser === player.name) {
            const winner = players.find((p) => p.name === match.winner);
            const { updatedLoserScore } = calculateElo(eloScore, winner?.eloScore, 32);
            eloScore = updatedLoserScore;
          }
        }

        return { ...player, eloScore };
      });

      // Update the ELO scores in the "players" collection
      for (const updatedPlayer of updatedPlayers) {
        const playerDocRef = doc(db, "players", updatedPlayer.id);
        await updateDoc(playerDocRef, { eloScore: updatedPlayer.eloScore });
      }

      // Display a success message or perform any other action
      console.log("ELO scores updated successfully!");
    } catch (error) {
      console.error("Error updating ELO scores:", error);
    }
  };

  onMount(() => {
    // Retrieve the player statistics from the Firestore collection
    const unsubscribe = onSnapshot(collection(db, "players"), (snapshot) => {
      playerStats = snapshot.docs.map((doc) => doc.data());
    });

    return unsubscribe;
  });
</script>

<main>
  <h1>Enter Winner and Loser Names</h1>
  <form on:submit|preventDefault={handleSubmit}>
    <label for="winner">Winner:</label>
    <input
      type="text"
      id="winner"
      bind:value={winnerName}
      placeholder="Enter winner name"
      required
    />

    <label for="loser">Loser:</label>
    <input
      type="text"
      id="loser"
      bind:value={loserName}
      placeholder="Enter loser name"
      required
    />

    <button type="submit">Submit</button>
  </form>
</main>
