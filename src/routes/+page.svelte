<script lang="ts">
	import { onMount } from 'svelte';
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
		orderBy
	} from 'firebase/firestore';
	import { calculateNewElo, calculateNewStreak } from '$lib/calc';

	const firebaseConfig = {
		apiKey: 'AIzaSyCBOYHYzC2DYlk2OUT8QDCI_19RJcoqYjk',
		authDomain: 'vercel-sveltkit-elo.firebaseapp.com',
		projectId: 'vercel-sveltkit-elo',
		storageBucket: 'vercel-sveltkit-elo.appspot.com',
		messagingSenderId: '117068038321',
		appId: '1:117068038321:web:706d5d7afc274d47446290'
	};

	const app = initializeApp(firebaseConfig);
	const db = getFirestore(app);

	type Player = {
		name: string;
		eloScore: number;
		streak?: number; // i.e. -2 = 2 in a row losses, 3 = 3 in a row wins
	};

	type Match = {
		winner: string;
		loser: string;
		timestamp: number;
		// elo change is missing for old matches
		winnerEloChange?: number;
		loserEloChange?: number;
	};

	let winnerName = '';
	let loserName = '';
	let playerToBeCreated = 'John';
	let players: Player[] = [];
	let matchesPromise: Promise<void>;
	let matches: Match[] = [];
	let hidePeopleWithNoMatches = true;
	const color = ['gold', 'silver', 'goldenrod'];

	$: sortedPlayersDescending = players.sort((a, b) => b.eloScore - a.eloScore);

	$: {
		if (matches.length === 0 && !matchesPromise) {
			const matchesRef = collection(db, 'matches');
			const q = query(matchesRef, orderBy('timestamp', 'desc'));
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

			const { winner: newWinnerElo, loser: newLoserElo } = calculateNewElo({
				winner: winner.eloScore,
				loser: loser.eloScore
			});

			await setDoc(doc(db, 'matches', `${Date.now()}`), {
				winner: winnerName,
				loser: loserName,
				// can't sort descending by documentId so need to duplicate here
				timestamp: Date.now(),
				winnerEloChange: newWinnerElo - winner.eloScore,
				loserEloChange: newLoserElo - loser.eloScore
			});

			await updateDoc(doc(db, 'players', winner.id), {
				eloScore: newWinnerElo,
				streak: calculateNewStreak(1, winner.streak)
			});

			await updateDoc(doc(db, 'players', loser.id), {
				eloScore: newLoserElo,
				streak: calculateNewStreak(-1, loser.streak)
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

	function getNumberOfMatchesPlayed(playerName: string) {
		return matches.reduce(
			(count, match) => count + (match.winner === playerName || match.loser === playerName ? 1 : 0),
			0
		);
	}

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
	<h1>🏓 Ping pong scores</h1>
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
		<details>
			<summary>Add missing player</summary>
			<form on:submit|preventDefault={handleAddPlayer}>
				Name: <input type="text" bind:value={playerToBeCreated} />
			</form>
		</details>
	</div>

	<hr />

	<div class="cards">
		<article>
			<header>Scores</header>
			<table class="scores">
				{#each sortedPlayersDescending as player, i}
					<tr
						style={`background:${color[i] || 'white'}`}
						data-position={i}
						data-hide={hidePeopleWithNoMatches && getNumberOfMatchesPlayed(player.name) == 0}
					>
						<td>
							<details>
								<summary
									><span class="emoji">{player.name.split(' ')[0]}</span>
									{player.name.split(' ')[1]}</summary
								>
								<table class="stats">
									<tr><td>Matches played:</td><td>{getNumberOfMatchesPlayed(player.name)}</td></tr>
									{#if player.streak && Math.abs(player.streak) > 1}
										<tr
											><td>{player.streak >= 0 ? 'Winning' : 'Losing'} streak:</td><td
												>{Math.abs(player.streak)}</td
											></tr
										>
									{/if}
								</table>
							</details>
						</td>
						<td>{Math.round(player.eloScore)}</td>
					</tr>
				{/each}
			</table>
			<label>
				<span>Hide people with no matches</span>
				<input type="checkbox" bind:checked={hidePeopleWithNoMatches} />
			</label>
		</article>

		<article>
			<header>Recent matches</header>
			{#await matchesPromise}
				<div>Retrieving matches...</div>
			{:then}
				<table>
					{#each matches as match}
						<tr>
							<td style="background: YellowGreen">
								{match.winner}
								<!-- {#if match.winnerEloChange}
									<sup class="elo-change positive">+{match.winnerEloChange}</sup>
								{/if} -->
							</td>
							<td class="points"
								>{#if match.winnerEloChange}{match.winnerEloChange}{/if}</td
							>
							<td style="background: LightCoral">
								{match.loser}
								<!-- {#if match.loserEloChange}
									<sup class="elo-change negative">{match.loserEloChange}</sup>
								{/if} -->
							</td>
							<td class="date">{new Date(Number(match.timestamp)).toDateString()}</td>
						</tr>
					{/each}
				</table>
			{:catch error}
				<p class="error">Error fetching matches: {JSON.stringify(error)}</p>
			{/await}
		</article>
	</div>

	<hr />
</main>

<style>
	:global(body) {
		font-family: 'Nunito', sans-serif;
		margin: 0 max(10px, calc((100% - 800px) / 2));
	}
	:global(*, *::before, *::after) {
		box-sizing: border-box;
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
		font-size: 18px;
	}
	.players .selected {
		border: 2px solid red;
	}

	.add {
		padding-block: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 20px;
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

	.elo-change {
		font-size: 10px;
	}

	.positive {
		color: #08ff08;
	}

	.negative {
		color: #ff2226;
	}

	.cards {
		display: flex;
		flex-flow: row nowrap;
		gap: 20px;
		justify-content: flex-start;
		align-items: flex-start;
		overflow-x: scroll;
	}
	article {
		background: LightBlue;
		border-radius: 10px;
		padding: 10px 15px 15px;
		flex: 1 0 300px;
	}

	header {
		font-family: Belanosima, sans-serif;
		font-size: 30px;
		margin-bottom: 10px;
		color: #00000066;
	}

	table {
		width: 100%;
		margin: auto;
	}
	table tr[data-hide='true'] {
		display: none;
	}
	table td {
		padding: 3px 8px;
		white-space: nowrap;
		text-align: left;
	}
	table td.points {
		padding: 0 4px;
		text-align: center;
		font-size: 12px;
	}
	table td.date {
		font-size: 10px;
		opacity: 0.6;
	}
	table.scores td:nth-child(2) {
		text-align: right;
	}

	table.stats {
		border-collapse: collapse;
	}
	table.stats td {
		border: 1px solid #00000022;
		padding: 2px;
		font-size: 16px;
	}
	.error {
		color: red;
	}
	@keyframes vibeBronze {
		0% {
			translate: -0.69px 0.548px;
		}
		5% {
			translate: -1.21px 0.326px;
		}
		10% {
			translate: 0.56px 0.649px;
		}
		15% {
			translate: 0.61px 0.798px;
		}
		20% {
			translate: 0.932px 0.73px;
		}
		25% {
			translate: 0.48px 0.649px;
		}
		30% {
			translate: 1.44px -1.39px;
		}
		35% {
			translate: 0.778px -0.5px;
		}
		40% {
			translate: -0.1895px -1.27px;
		}
		45% {
			translate: 0.911px -0.65px;
		}
		50% {
			translate: 0.589px -1.5px;
		}
		55% {
			translate: -1.25px -0.121px;
		}
		60% {
			translate: -0.75px 1.15px;
		}
		65% {
			translate: -0.361px 0.1895px;
		}
		70% {
			translate: -0.74px -0.66px;
		}
		75% {
			translate: 0.379px -1.09px;
		}
		80% {
			translate: 0.56px -0.51px;
		}
		85% {
			translate: 0.94px -0.129px;
		}
		90% {
			translate: 0.839px -0.0109px;
		}
		95% {
			translate: 1.33px -1.26px;
		}
	}
	@keyframes vibeSilver {
		0% {
			translate: 0px 0.129px;
		}
		5% {
			translate: -0.77px -1.9px;
		}
		10% {
			translate: -1.27px 1.42px;
		}
		15% {
			translate: -1.109px -0.05044px;
		}
		20% {
			translate: 0.891px 0.2018px;
		}
		25% {
			translate: 0.75px 0.96px;
		}
		30% {
			translate: -1.5px -0.591px;
		}
		35% {
			translate: 0.1693px 1.641px;
		}
		40% {
			translate: 0.831px -0.389px;
		}
		45% {
			translate: 0.649px 0.399px;
		}
		50% {
			translate: -0.2096px 0.742px;
		}
		55% {
			translate: -0.3307px 1.008px;
		}
		60% {
			translate: -0.28px 0.972px;
		}
		65% {
			translate: -1.35px -1.67px;
		}
		70% {
			translate: 0.52px 1.38px;
		}
		75% {
			translate: -0.611px 0.818px;
		}
		80% {
			translate: -1.74px 0.359px;
		}
		85% {
			translate: -1.05px 0.149px;
		}
		90% {
			translate: 0.96px 0.472px;
		}
		95% {
			translate: -0.0807px 0.298px;
		}
	}
	@keyframes vibeGold {
		0% {
			translate: -0.7px -1.08px;
		}
		5% {
			translate: 0.2598px 2px;
		}
		10% {
			translate: -0.77px 0.5px;
		}
		15% {
			translate: 2.404px -1.21px;
		}
		20% {
			translate: -2.02px -2.46px;
		}
		25% {
			translate: 0.8999px -0.52px;
		}
		30% {
			translate: 2.08px -0.3599px;
		}
		35% {
			translate: -2.48px 1.31px;
		}
		40% {
			translate: -2.36px 1.573px;
		}
		45% {
			translate: -0.10988px 0.98px;
		}
		50% {
			translate: -0.6499px -1.98px;
		}
		55% {
			translate: 0.5px 0.06984px;
		}
		60% {
			translate: -0.1299px -1.62px;
		}
		65% {
			translate: -1.53px 0.5098px;
		}
		70% {
			translate: -1.56px 0.6699px;
		}
		75% {
			translate: -2.21px -1.49px;
		}
		80% {
			translate: 1.15px 1.92px;
		}
		85% {
			translate: -1.26px -1.23px;
		}
		90% {
			translate: -1.41px -2.5px;
		}
		95% {
			translate: 2.1397px -2.4px;
		}
	}

	[data-position='0'] {
		font-size: 24px;
		font-weight: bold;
	}
	[data-position='1'] {
		font-size: 20px;
		font-weight: bold;
	}
	[data-position='2'] {
		font-size: 18px;
		font-weight: bold;
	}
	.emoji {
		display: inline-block;
	}
	[data-position='0'] .emoji {
		animation: 1s linear 0s infinite alternate vibeGold;
	}
	[data-position='1'] .emoji {
		animation: 2s linear 0s infinite alternate vibeSilver;
	}
	[data-position='2'] .emoji {
		animation: 3s linear 0s infinite alternate vibeBronze;
	}
</style>
