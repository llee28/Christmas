```md
# Christmas Gift Exchange (client-side demo)

Lightweight client-side demo for a gift-giving website:
- Users create a username and log in.
- Play minigames to earn "Christmas coins".
- Spend coins in a gift catalog to send virtual presents to other usernames.
- Gifts arrive in recipient inbox but remain locked until Christmas Day (Dec 25 of the year they were sent).
- On Christmas Day gifts can be opened and moved to the collection.
- All data persisted in browser localStorage for demo/testing.

Files:
- index.html — main UI
- styles.css — styling
- app.js — application logic (accounts, minigames, catalog, sending gifts, opening)

How to run:
1. Place files in your repository (root or a folder).
2. Open index.html in a modern browser (Chrome/Edge/Firefox).
3. Create a username and try the features.

Notes for production:
- This demo stores everything in localStorage. For real usage:
  - Add a server with authentication and a database.
  - Add user verification, rate limits, anti-abuse.
  - Move gifts/transactions to server-side to prevent client cheats.
  - Add images/media for gifts and nicer minigames.

Developer testing:
- Use the "Open now (dev)" button in the account area to bypass waiting until Dec 25.

License: MIT
```
