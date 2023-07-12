<script lang="ts">
	import { onMount } from 'svelte';
	import EloRank from 'elo-rank';
	// Import the Firebase SDK and initialize the Firestore database
	import { initializeApp } from 'firebase/app';
	import {
		getFirestore,
		collection,
		getDocs,
		addDoc,
		query,
		where,
		limit,
		updateDoc,
		doc,
		setDoc
	} from 'firebase/firestore';

	const firebaseConfig = {
		apiKey: 'AIzaSyCBOYHYzC2DYlk2OUT8QDCI_19RJcoqYjk',
		authDomain: 'vercel-sveltkit-elo.firebaseapp.com',
		projectId: 'vercel-sveltkit-elo',
		storageBucket: 'vercel-sveltkit-elo.appspot.com',
		messagingSenderId: '117068038321',
		appId: '1:117068038321:web:706d5d7afc274d47446290'
	};

	// IF YOU CHANGE THIS ARG YOU SHOULD RECALCULATE ALL ELOS
	const elo = new EloRank(40);

	const app = initializeApp(firebaseConfig);
	const db = getFirestore(app);

	type Player = {
		name: string;
		eloScore: number;
	};

	let winnerName = '';
	let loserName = '';
	let playerToBeCreated = 'John';
	let players: Player[] = [];
	let matches = [];

	const calculateNewElo = ({
		winner,
		loser
	}: {
		winner: number;
		loser: number;
	}): { winner: number; loser: number } => {
		const expectedScoreWinner = elo.getExpected(winner, loser);
		const expectedScoreLoser = elo.getExpected(loser, winner);
		return {
			winner: elo.updateRating(expectedScoreWinner, 1, winner),
			loser: elo.updateRating(expectedScoreLoser, 0, loser)
		};
	};

	const getPlayer = async (name: string): Promise<(Player & { id: string }) | null> => {
		const playersRef = collection(db, 'players');
		const q = query(playersRef, where('name', '==', name), limit(1));
		const querySnapshot = await getDocs(q);
		if (querySnapshot.empty) {
			return null;
		}
		return {
			...querySnapshot.docs[0].data(),
			id: querySnapshot.docs[0].id
		} as Player & {
			id: string;
		};
	};

	const createPlayerIfNotExists = async (playerName: string) => {
		// Check if the player already exists in the "players" collection
		const playersRef = collection(db, 'players');
		const q = query(playersRef, where('name', '==', playerName), limit(1));
		const querySnapshot = await getDocs(q);

		if (querySnapshot.empty) {
			// Player does not exist, create a new document in the "players" collection
			await addDoc(playersRef, { name: playerName, eloScore: 1200 });
			console.log('New player created:', playerName);
		}
	};

	const handleAddPlayer = async () => {
		console.log(playerToBeCreated);
		await createPlayerIfNotExists(playerToBeCreated);
		window.location.reload();
	};

	const handleSubmit = async () => {
		if (!winnerName || !loserName) return;
		try {
			const winner = await getPlayer(winnerName);
			const loser = await getPlayer(loserName);
			if (!winner || !loser) {
				return console.error('Missing at least one player:', winner, loser);
			}
			await setDoc(doc(db, 'matches', `${Date.now()}`), {
				winner: winnerName,
				loser: loserName
			});
			const { winner: newWinnerElo, loser: newLoserElo } = calculateNewElo({
				winner: winner.eloScore,
				loser: loser.eloScore
			});

			await updateDoc(doc(db, 'players', winner.id), {
				eloScore: newWinnerElo
			});

			await updateDoc(doc(db, 'players', loser.id), {
				eloScore: newLoserElo
			});
		} catch (error) {
			console.error('Error storing names:', error);
		}
	};

	onMount(async () => {
		const playersSnapshot = await getDocs(collection(db, 'players'));

		// @ts-ignore
		players = playersSnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
	});
</script>

<main>
	<h1>Add match</h1>
	<h2>Winner</h2>
	{#each players as player}
		<button
			on:click={() => (winnerName = player.name)}
			type="button"
			class={winnerName == player.name ? 'selected' : ''}>{player.name}</button
		>
	{/each}

	<h2>Loser</h2>
	{#each players as player}
		<button
			on:click={() => (loserName = player.name)}
			type="button"
			class={loserName == player.name ? 'selected' : ''}>{player.name}</button
		>
	{/each}

	<form on:submit|preventDefault={handleSubmit}>
		<button type="submit">Update ELO</button>
	</form>
	<hr />
	<h1>Scores</h1>
	<table>
		{#each players as player}
			<tr>
				<td>{player.name}</td>
				<td>{player.eloScore}</td>
			</tr>
		{/each}
	</table>

	<hr />
	<details>
		<summary>Add missing player</summary>
		<form on:submit|preventDefault={handleAddPlayer}>
			Name: <input type="text" bind:value={playerToBeCreated} />
		</form>
	</details>
</main>

<style>
	.selected {
		border: 2px solid red;
	}
</style>
