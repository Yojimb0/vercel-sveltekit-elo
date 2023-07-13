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
		setDoc,
		orderBy,
		documentId
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

	type Match = {
		winner: string;
		loser: string;
		timestamp: string;
	};

	let winnerName = '';
	let loserName = '';
	let playerToBeCreated = 'John';
	let players: Player[] = [];
	let matchesPromise: Promise<void>;
	let matches: Match[] = [];
	let currentView: 'scores' | 'matches' = 'scores';
	const color = ['gold', 'silver', 'darkgoldenrod'];

	$: sortedPlayersDescending = players.sort((a, b) => b.eloScore - a.eloScore);

	$: {
		if (currentView === 'matches' && matches.length === 0 && !matchesPromise) {
			const matchesRef = collection(db, 'matches');
			const q = query(matchesRef, orderBy('timestamp', 'desc'), limit(20));
			matchesPromise = getDocs(q).then((res) => {
				if (res.empty) {
					return;
				}
				matches = res.docs.map(
					(doc) =>
						({
							...doc.data()
						} as Match)
				);
			});
		}
	}

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
				loser: loserName,
				// can't sort descending by documentId so need to duplicate here
				timestamp: Date.now()
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

			// optimistic update
			players = players.map((player) => {
				if (player.name === winner.name) {
					return {
						...player,
						eloScore: newWinnerElo
					};
				} else if (player.name === loser.name) {
					return {
						...player,
						eloScore: newLoserElo
					};
				}
				return player;
			});

			matches = [
				{
					winner: winnerName,
					loser: loserName,
					timestamp: Date.now()
				},
				...matches
			];
		} catch (error) {
			console.error('Error storing names:', error);
		}

		winnerName = '';
		loserName = '';
	};

	onMount(async () => {
		const playersSnapshot = await getDocs(collection(db, 'players'));

		// @ts-ignore
		players = playersSnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
	<link
		href="https://fonts.googleapis.com/css2?family=Belanosima&family=Nunito&display=swap"
		rel="stylesheet"
	/>
</svelte:head>
<main>
	<h1>Ping pong scores</h1>
	<h2>Winner</h2>
	<div class="players">
		{#each players as player}
			<button
				on:click={() => {
					if (winnerName == player.name) {
						winnerName = '';
					} else {
						winnerName = player.name;
					}
					loserName = '';
				}}
				type="button"
				class={winnerName == player.name ? 'selected' : ''}
			>
				{player.name}
			</button>
		{/each}
	</div>

	<h2>Loser</h2>
	<div class="players">
		{#each players as player}
			<button
				on:click={() => {
					if (loserName == player.name) {
						loserName = '';
					} else {
						loserName = player.name;
					}
				}}
				type="button"
				class={loserName == player.name ? 'selected' : ''}
				disabled={!winnerName || winnerName == player.name}
			>
				{player.name}
			</button>
		{/each}
	</div>
	<div class="add">
		<form on:submit|preventDefault={handleSubmit}>
			<button type="submit">Add match</button>
		</form>
	</div>
	<hr />
	<button
		on:click={() => {
			currentView = currentView === 'scores' ? 'matches' : 'scores';
		}}>View {currentView === 'scores' ? 'matches' : 'scores'}</button
	>
	{#if currentView === 'scores'}
		<h1>Scores</h1>
		<table class="scores">
			{#each sortedPlayersDescending as player, i}
				<tr style={`background:${color[i] || 'white'}`}>
					<td>{player.name}</td>
					<td>{Math.round(player.eloScore)}</td>
				</tr>
			{/each}
		</table>
	{:else if currentView === 'matches'}
		{#await matchesPromise}
			<div>Retrieving matches...</div>
		{:then}
			<h1>Recent matches</h1>
			<table>
				{#each matches as match}
					<tr>
						<td style="background: #C1E1C1">{match.winner}</td>
						<td style="background: #ff6961">{match.loser}</td>
						<td>{new Date(Number(match.timestamp)).toDateString()}</td>
					</tr>
				{/each}
			</table>
		{:catch error}
			<p class="error">Error fetching matches: {JSON.stringify(error)}</p>
		{/await}
	{/if}
	<hr />
	<details>
		<summary>Add missing player</summary>
		<form on:submit|preventDefault={handleAddPlayer}>
			Name: <input type="text" bind:value={playerToBeCreated} />
		</form>
	</details>
</main>

<style>
	:global(body) {
		font-family: 'Nunito', sans-serif;
		margin: 0 max(10px, calc((100% - 500px) / 2));
	}
	h1 {
		margin: 0 0 20px;
	}
	h2 {
		margin: 0 0 15px;
	}
	h1,
	h2 {
		font-family: 'Belanosima', sans-serif;
	}

	.players {
		display: flex;
		gap: 10px;
		flex-flow: row wrap;
		margin-block-end: 15px;
	}
	.players button {
		border: 2px solid #ddd;
		height: 35px;
		display: inline-flex;
		justify-content: center;
		align-items: center;
		border-radius: 3px;
		cursor: pointer;
	}
	.players .selected {
		border: 2px solid red;
	}

	.add {
		padding-block: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.add button {
		font-size: larger;
		border: 2px solid #ddd;
		height: 35px;
		display: inline-flex;
		justify-content: center;
		align-items: center;
		border-radius: 3px;
		font-family: 'Belanosima', sans-serif;
		padding-inline: 10px;
		cursor: pointer;
	}
	table {
		width: 300px;
		margin: auto;
	}
	table td {
		padding: 3px 8px;
		white-space: nowrap;
		text-align: left;
	}
	table.scores td:nth-child(2) {
		text-align: right;
	}
	.error {
		color: red;
	}
</style>
