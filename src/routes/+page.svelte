<script>
  import { onMount } from "svelte";

  // Import the Firebase SDK and initialize the Firestore database
  import { initializeApp } from 'firebase/app';
  import { getFirestore, collection, getDocs, addDoc } from 'firebase/firestore/lite';

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

  const handleSubmit = async () => {
    try {
      // Store the winner and loser names in the "names" collection of Firestore
      await addDoc(collection(db, "names"), {
        winner: winnerName,
        loser: loserName,
      });

      // Reset the input fields
      winnerName = "";
      loserName = "";

      // Display a success message or perform any other action
      console.log("Names stored successfully!");
    } catch (error) {
      console.error("Error storing names:", error);
    }
  };

  onMount(() => {
    // Optional: Perform any additional setup or data retrieval here
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
