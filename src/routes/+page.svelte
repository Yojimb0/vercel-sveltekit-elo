<script>
  import { onMount } from "svelte";

  // Import the Firebase SDK and initialize the Firestore database
  import { initializeApp } from 'firebase/app';
  import { getFirestore, collection, getDocs, getDoc, addDoc, query, where, limit, updateDoc, doc, onSnapshot, setDoc } from "firebase/firestore";

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
  let playerToBeCreated = "John";
  let players=[];
  let matches=[];

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

  const handleAddPlayer = async () => {
    console.log(playerToBeCreated);
    await createPlayerIfNotExists(playerToBeCreated);
    window.location.reload();
  }

  const handleSubmit = async () => {
    try {
      // Store the winner and loser names in the "names" collection of Firestore
      await setDoc(doc(db, "matches", `${Date.now()}`), {
        winner: winnerName,
        loser: loserName,
      });

	  updateEloScores();
    } catch (error) {
      console.error("Error storing names:", error);
    }
  };


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
      const matchesSnapshot = await getDocs(collection(db, "matches"));
      matches = matchesSnapshot.docs.map((doc) => doc.data());
      console.log("matches", matches)
    } catch (error) {
      console.error("Error Retrieve the matches from the names collection:", error);
    }
    try {
      // Retrieve the players from the "players" collection
      const playersSnapshot = await getDocs(collection(db, "players"));
      players = playersSnapshot.docs.map((doc) => ({...doc.data(), id: doc.id}));
      console.log("players", players)
    } catch (error) {
      console.error("Error Retrieve the players from the players collection:", error);
    }
	//try {
      // Calculate and update the ELO scores for each player
      const updatedPlayers = players.map((player) => {
        let { eloScore, name, id } = player;

        for (const match of matches) {
          if (match.winner === name) {
            const loser = players.find((p) => p.name === match.loser);
            const { updatedWinnerScore } = calculateElo(eloScore, loser?.eloScore, 32);
            eloScore = updatedWinnerScore;
          } else if (match.loser === player.name) {
            const winner = players.find((p) => p.name === match.winner);
            const { updatedLoserScore } = calculateElo(eloScore, winner?.eloScore, 32);
            eloScore = updatedLoserScore;
          }
        }
        return { name, eloScore, id };
      });
	  
	  console.log("updatedPlayers", updatedPlayers)
      // Update the ELO scores in the "players" collection
      for (const updatedPlayer of updatedPlayers) {
		console.log("updatedPlayer", updatedPlayer);
		//const documentPath = doc(db, 'players', updatedPlayer.id);
		//await updateDoc(documentPath, { eloScore: updatedPlayer.eloScore });
		const docRef = doc(db, 'players/'+updatedPlayer.id);
		// const docSnap = await getDoc(docRef);
		await updateDoc(docRef, {eloScore: updatedPlayer.eloScore});
		console.log("Doc updated?");
      }

      // Display a success message or perform any other action
      console.log("ELO scores updated successfully!");
    //} catch (error) {
    //  console.error("Error updating ELO scores:", error);
    //}
  };

  onMount(async () => {
    // Retrieve the player statistics from the Firestore collection
    //const unsubscribe = onSnapshot(collection(db, "players"), (snapshot) => {
     // playerStats = snapshot.docs.map((doc) => doc.data());
    //});

    //return unsubscribe;

	const playersSnapshot = await getDocs(collection(db, "players"));
	players = playersSnapshot.docs.map((doc) => ({...doc.data(), id: doc.id}));
  });
</script>

<main>

  
    <h1>Add match</h1>
    <h2>Winner</h2>
    {#each players as player}
      <button on:click={()=>winnerName=player.name} type="button" class={winnerName==player.name?"selected":""}>{player.name}</button>
    {/each}

    <h2>Loser</h2>
    {#each players as player}
      <button on:click={()=>loserName=player.name} type="button" class={loserName==player.name?"selected":""}>{player.name}</button>
    {/each}
  
    <form on:submit|preventDefault={handleSubmit}>
      <button type="submit">Update ELO</button>
    </form>

    <h1>Scores</h1>
<table>
{#each players as player}
<tr>
  <td>{player.name}</td>
  <td>{player.eloScore}</td>
</tr>
{/each}

</table>


<details>
  <summary><h1>Add missing player</h1></summary>
  <form on:submit|preventDefault={handleAddPlayer}>
    Name: <input type="text" bind:value={playerToBeCreated}>
  </form>
</details>
  
  
</main>


<style>
  .selected{border:2px solid red}
  </style>