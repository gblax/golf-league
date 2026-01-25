import React, { useState, useEffect } from 'react';
import { Trophy, Users, Calendar, CheckCircle, XCircle, TrendingUp, Bell, Shield, Mail } from 'lucide-react';

const App = () => {
const [activeTab, setActiveTab] = useState('picks');
const [selectedPlayer, setSelectedPlayer] = useState('');
const [backupPlayer, setBackupPlayer] = useState('');
const [emailNotifications, setEmailNotifications] = useState(true);
const [showSettings, setShowSettings] = useState(false);
const [leagueData, setLeagueData] = useState({
players: [
{
id: 1,
name: 'Alice Johnson',
email: 'alice@example.com',
points: 145,
picks: ['Scottie Scheffler', 'Rory McIlroy'],
currentPick: { golfer: 'Xander Schauffele', backup: 'Max Homa' }
},
{
id: 2,
name: 'Bob Smith',
email: 'bob@example.com',
points: 132,
picks: ['Jon Rahm', 'Viktor Hovland'],
currentPick: { golfer: 'Brooks Koepka', backup: 'Justin Thomas' }
},
{
id: 3,
name: 'Carol Davis',
email: 'carol@example.com',
points: 128,
picks: ['Xander Schauffele', 'Collin Morikawa'],
currentPick: { golfer: 'Jordan Spieth', backup: '' }
},
{
id: 4,
name: 'David Lee',
email: 'david@example.com',
points: 115,
picks: ['Brooks Koepka', 'Patrick Cantlay'],
currentPick: { golfer: '', backup: '' }
}
],
currentWeek: 3,
pickDeadline: '2026-06-11T18:00:00',
tournaments: [
{ id: 1, name: 'The Masters', week: 1, date: '2026-04-09', completed: true },
{ id: 2, name: 'PGA Championship', week: 2, date: '2026-05-14', completed: true },
{ id: 3, name: 'U.S. Open', week: 3, date: '2026-06-18', completed: false },
{ id: 4, name: 'The Open Championship', week: 4, date: '2026-07-16', completed: false }
],
availableGolfers: [
'Scottie Scheffler', 'Rory McIlroy', 'Jon Rahm', 'Viktor Hovland',
'Xander Schauffele', 'Collin Morikawa', 'Brooks Koepka', 'Patrick Cantlay',
'Justin Thomas', 'Jordan Spieth', 'Max Homa', 'Tony Finau',
'Dustin Johnson', 'Cameron Smith', 'Tommy Fleetwood', 'Hideki Matsuyama'
]
});

const currentUser = 'Alice Johnson';
const userObj = leagueData.players.find(p => p.name === currentUser);
const userPicks = userObj?.picks || [];
const currentUserPick = userObj?.currentPick || { golfer: '', backup: '' };
const availableForPick = leagueData.availableGolfers.filter(g => !userPicks.includes(g));

useEffect(() => {
if (userObj?.currentPick) {
setSelectedPlayer(userObj.currentPick.golfer);
setBackupPlayer(userObj.currentPick.backup);
}
}, []);

const handleSubmitPick = () => {
if (!selectedPlayer) {
alert('Please select a primary golfer');
return;
}

if (backupPlayer && backupPlayer === selectedPlayer) {
alert('Backup golfer must be different from primary pick');
return;
}

const updated = { ...leagueData };
const user = updated.players.find(p => p.name === currentUser);
if (user) {
user.currentPick = { golfer: selectedPlayer, backup: backupPlayer };
setLeagueData(updated);
alert(`Pick submitted!\nPrimary: ${selectedPlayer}${backupPlayer ? `\nBackup: ${backupPlayer}` : ''}`);
}
};

const sendEmailReminder = () => {
alert('Email reminder sent to all players who haven\'t submitted picks!');
};

const getTimeUntilDeadline = () => {
const deadline = new Date(leagueData.pickDeadline);
const now = new Date();
const diff = deadline - now;
const hours = Math.floor(diff / (1000 * 60 * 60));
return hours > 0 ? `${hours} hours` : 'Past deadline';
};

const sortedStandings = [...leagueData.players].sort((a, b) => b.points - a.points);

return (
<div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
<div className="max-w-6xl mx-auto p-6">
{/* Header */}
<div className="bg-white rounded-lg shadow-lg p-8 mb-6">
<div className="flex items-center justify-between">
<div>
<h1 className="text-4xl font-bold text-green-800 flex items-center gap-3">
<Trophy className="text-yellow-500" size={40} />
Golf One and Done League
</h1>
<p className="text-gray-600 mt-2">Week {leagueData.currentWeek} - {leagueData.tournaments[leagueData.currentWeek - 1]?.name}</p>
</div>
<div className="text-right">
<p className="text-sm text-gray-600">Playing as</p>
<p className="text-xl font-bold text-green-700">{currentUser}</p>
<button
onClick={() => setShowSettings(!showSettings)}
className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
>
<Bell size={16} />
Notification Settings
</button>
</div>
</div>

{/* Pick Deadline Alert */}
<div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-4">
<div className="flex items-center justify-between">
<div className="flex items-center gap-2">
<Calendar className="text-yellow-600" size={20} />
<span className="font-semibold text-yellow-800">
Pick Deadline: {new Date(leagueData.pickDeadline).toLocaleString()}
</span>
</div>
<span className="text-yellow-700 font-bold">
{getTimeUntilDeadline()} remaining
</span>
</div>
</div>

{/* Settings Panel */}
{showSettings && (
<div className="mt-4 bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
<h3 className="font-bold text-lg mb-4 flex items-center gap-2">
<Mail className="text-blue-600" />
Email Notification Settings
</h3>
<div className="space-y-3">
<label className="flex items-center gap-3 cursor-pointer">
<input
type="checkbox"
checked={emailNotifications}
onChange={(e) => setEmailNotifications(e.target.checked)}
className="w-5 h-5 text-green-600"
/>
<span className="text-gray-700">
Send me email reminders the night before picks are due
</span>
</label>
<p className="text-sm text-gray-500 ml-8">
Reminder emails will be sent at 8:00 PM the day before the deadline
</p>
<div className="ml-8 mt-2">
<p className="text-sm font-semibold text-gray-700">Your email: {userObj?.email}</p>
</div>
</div>
</div>
)}
</div>

{/* Navigation Tabs */}
<div className="bg-white rounded-lg shadow-lg mb-6">
<div className="flex border-b">
<button
onClick={() => setActiveTab('picks')}
className={`flex-1 py-4 px-6 font-semibold flex items-center justify-center gap-2 ${
activeTab === 'picks'
? 'border-b-4 border-green-600 text-green-700'
: 'text-gray-500 hover:text-gray-700'
}`}
>
<CheckCircle size={20} />
Make Pick
</button>
<button
onClick={() => setActiveTab('standings')}
className={`flex-1 py-4 px-6 font-semibold flex items-center justify-center gap-2 ${
activeTab === 'standings'
? 'border-b-4 border-green-600 text-green-700'
: 'text-gray-500 hover:text-gray-700'
}`}
>
<TrendingUp size={20} />
Standings
</button>
<button
onClick={() => setActiveTab('schedule')}
className={`flex-1 py-4 px-6 font-semibold flex items-center justify-center gap-2 ${
activeTab === 'schedule'
? 'border-b-4 border-green-600 text-green-700'
: 'text-gray-500 hover:text-gray-700'
}`}
>
<Calendar size={20} />
Schedule
</button>
<button
onClick={() => setActiveTab('admin')}
className={`flex-1 py-4 px-6 font-semibold flex items-center justify-center gap-2 ${
activeTab === 'admin'
? 'border-b-4 border-green-600 text-green-700'
: 'text-gray-500 hover:text-gray-700'
}`}
>
<Bell size={20} />
Admin
</button>
</div>

{/* Tab Content */}
<div className="p-6">
{activeTab === 'picks' && (
<div>
<h2 className="text-2xl font-bold text-gray-800 mb-4">Submit Your Pick</h2>

{/* Backup Pick Explanation */}
<div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
<div className="flex items-start gap-3">
<Shield className="text-blue-600 mt-1" size={24} />
<div>
<p className="font-semibold text-blue-800 mb-1">Backup Pick Feature</p>
<p className="text-blue-700 text-sm">
Select a backup golfer in case your primary pick withdraws before the tournament starts.
Your backup will automatically be used only if your primary pick withdraws.
Remember: You can only use each golfer once per season!
</p>
</div>
</div>
</div>

<div className="mb-6">
<h3 className="font-semibold text-gray-700 mb-3">Your Previous Picks:</h3>
<div className="flex flex-wrap gap-2">
{userPicks.map((pick, idx) => (
<span key={idx} className="bg-gray-200 px-4 py-2 rounded-full text-sm text-gray-700">
{pick}
</span>
))}
{userPicks.length === 0 && (
<span className="text-gray-500 italic">No picks yet</span>
)}
</div>
</div>

{/* Primary Pick */}
<div className="mb-6 p-4 bg-green-50 rounded-lg border-2 border-green-200">
<label className="block font-semibold text-gray-800 mb-2 flex items-center gap-2">
<CheckCircle className="text-green-600" size={20} />
Primary Pick for Week {leagueData.currentWeek}:
</label>
<select
value={selectedPlayer}
onChange={(e) => setSelectedPlayer(e.target.value)}
className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
>
<option value="">-- Choose your primary golfer --</option>
{availableForPick.map((golfer, idx) => (
<option key={idx} value={golfer}>{golfer}</option>
))}
</select>
</div>

{/* Backup Pick */}
<div className="mb-6 p-4 bg-amber-50 rounded-lg border-2 border-amber-200">
<label className="block font-semibold text-gray-800 mb-2 flex items-center gap-2">
<Shield className="text-amber-600" size={20} />
Backup Pick (Optional but Recommended):
</label>
<select
value={backupPlayer}
onChange={(e) => setBackupPlayer(e.target.value)}
className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-amber-500 focus:outline-none"
>
<option value="">-- Choose a backup golfer --</option>
{availableForPick.filter(g => g !== selectedPlayer).map((golfer, idx) => (
<option key={idx} value={golfer}>{golfer}</option>
))}
</select>
<p className="text-sm text-gray-600 mt-2">
Your backup will only be used if {selectedPlayer || 'your primary pick'} withdraws before the tournament
</p>
</div>

<button
onClick={handleSubmitPick}
disabled={!selectedPlayer}
className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
>
Submit Pick
</button>

{selectedPlayer && (
<div className="mt-4 p-4 bg-gray-100 rounded-lg">
<h4 className="font-semibold mb-2">Your Current Selection:</h4>
<p className="text-gray-700">
<strong>Primary:</strong> {selectedPlayer}
</p>
{backupPlayer && (
<p className="text-gray-700">
<strong>Backup:</strong> {backupPlayer}
</p>
)}
</div>
)}
</div>
)}

{activeTab === 'standings' && (
<div>
<h2 className="text-2xl font-bold text-gray-800 mb-4">League Standings</h2>
<div className="overflow-x-auto">
<table className="w-full">
<thead>
<tr className="bg-gray-100">
<th className="py-3 px-4 text-left font-semibold text-gray-700">Rank</th>
<th className="py-3 px-4 text-left font-semibold text-gray-700">Player</th>
<th className="py-3 px-4 text-center font-semibold text-gray-700">Points</th>
<th className="py-3 px-4 text-center font-semibold text-gray-700">Picks Used</th>
<th className="py-3 px-4 text-center font-semibold text-gray-700">This Week</th>
</tr>
</thead>
<tbody>
{sortedStandings.map((player, idx) => (
<tr
key={player.id}
className={`border-b hover:bg-gray-50 ${player.name === currentUser ? 'bg-green-50 font-semibold' : ''}`}
>
<td className="py-3 px-4">
{idx === 0 && <Trophy className="inline text-yellow-500 mr-2" size={20} />}
{idx + 1}
</td>
<td className="py-3 px-4">{player.name}</td>
<td className="py-3 px-4 text-center">{player.points}</td>
<td className="py-3 px-4 text-center">{player.picks.length}</td>
<td className="py-3 px-4 text-center">
{player.currentPick?.golfer ? (
<div>
<div className="text-green-700">{player.currentPick.golfer}</div>
{player.currentPick.backup && (
<div className="text-xs text-gray-500">Backup: {player.currentPick.backup}</div>
)}
</div>
) : (
<span className="text-red-500">Not submitted</span>
)}
</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
)}

{activeTab === 'schedule' && (
<div>
<h2 className="text-2xl font-bold text-gray-800 mb-4">Tournament Schedule</h2>
<div className="space-y-3">
{leagueData.tournaments.map((tournament) => (
<div
key={tournament.id}
className={`p-4 rounded-lg border-2 ${
tournament.week === leagueData.currentWeek
? 'border-green-500 bg-green-50'
: tournament.completed
? 'border-gray-300 bg-gray-50'
: 'border-blue-300 bg-blue-50'
}`}
>
<div className="flex items-center justify-between">
<div>
<h3 className="font-bold text-lg">{tournament.name}</h3>
<p className="text-sm text-gray-600">Week {tournament.week} - {new Date(tournament.date).toLocaleDateString()}</p>
</div>
<div>
{tournament.completed ? (
<span className="flex items-center gap-2 text-gray-600">
<CheckCircle size={20} className="text-green-600" />
Completed
</span>
) : tournament.week === leagueData.currentWeek ? (
<span className="bg-green-600 text-white px-4 py-2 rounded-full font-semibold">
Current Week
</span>
) : (
<span className="text-blue-600 font-semibold">Upcoming</span>
)}
</div>
</div>
</div>
))}
</div>
</div>
)}

{activeTab === 'admin' && (
<div>
<h2 className="text-2xl font-bold text-gray-800 mb-4">Admin Panel</h2>

<div className="space-y-6">
{/* Email Reminders Section */}
<div className="bg-white border-2 border-gray-200 rounded-lg p-6">
<h3 className="font-bold text-lg mb-4 flex items-center gap-2">
<Mail className="text-blue-600" />
Email Notifications
</h3>

<div className="mb-4 p-4 bg-blue-50 rounded-lg">
<p className="text-sm text-gray-700 mb-2">
<strong>Automatic Reminders:</strong> Emails are automatically sent at 8:00 PM the night before picks are due
</p>
<p className="text-sm text-gray-700">
Only players who haven't submitted their picks will receive reminders
</p>
</div>

<button
onClick={sendEmailReminder}
className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
>
<Bell size={18} />
Send Manual Reminder Now
</button>
</div>

{/* Pick Status Overview */}
<div className="bg-white border-2 border-gray-200 rounded-lg p-6">
<h3 className="font-bold text-lg mb-4">Week {leagueData.currentWeek} Pick Status</h3>
<div className="space-y-2">
{leagueData.players.map(player => (
<div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
<div>
<p className="font-semibold">{player.name}</p>
<p className="text-sm text-gray-600">{player.email}</p>
</div>
<div className="text-right">
{player.currentPick?.golfer ? (
<div>
<CheckCircle className="inline text-green-600 mr-2" size={20} />
<span className="text-green-700 font-semibold">Submitted</span>
<p className="text-xs text-gray-600 mt-1">
{player.currentPick.golfer}
{player.currentPick.backup && ` (Backup: ${player.currentPick.backup})`}
</p>
</div>
) : (
<div>
<XCircle className="inline text-red-600 mr-2" size={20} />
<span className="text-red-700 font-semibold">Pending</span>
</div>
)}
</div>
</div>
))}
</div>
</div>
</div>
</div>
)}
</div>
</div>
</div>
</div>
);
};

export default App;
