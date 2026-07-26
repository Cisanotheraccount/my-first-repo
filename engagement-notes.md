# NYC Living Priorities

## Engagement Component

NYC Living Priorities is a four-option poll connected to Firebase Realtime Database. It extends the preceding rent timeline, relational network, and Manhattan map by asking visitors to contribute a small piece of situated feedback:

> When choosing a home in NYC, what matters most to you?

The options are Affordability, Space, Commute, and Community.

## Firebase Method

The implementation follows the course Firebase poll tutorial:

1. The Firebase web app is initialized with the project configuration.
2. A reference points to `livingPrioritiesPoll/votes` in Realtime Database.
3. A live `value` listener aggregates the four choices for every connected visitor.
4. A transaction creates one immutable vote under the one-way hash of the visitor's anonymous voting code.
5. The `.info/connected` reference reports the live connection state.

The website remains hosted on GitHub Pages. Firebase is used only for live data storage and synchronization.

## Visual System

The four aggregated results appear as an abstract city block. Each building's height represents that option's percentage of the total vote. The warm coral, yellow, blue, and green signals continue the color language used elsewhere in the NYC rental study. Height and percentage changes animate smoothly whenever Firebase receives a new vote.

## Data Ethics

The poll asks for a 6-20 character anonymous voting code and explicitly tells visitors not to enter a name or email address. The code is normalized and converted to a SHA-256 hash in the browser; only that one-way hash and the selected option are stored. A Firebase transaction prevents the same code from creating a second vote, while a local browser marker prevents accidental repeat voting on the same device.

This remains lightweight duplicate prevention rather than verified identity: a determined person could choose a different code. The poll does not request or store names, email addresses, income, exact location, demographic attributes, timestamps, or free-text responses.

The results reflect voluntary visitors to this website and should not be interpreted as a representative survey of New Yorkers. They are a small participatory design signal rather than formal housing research.

## Project Reflection

I could use an engagement component to turn my urban data visualizations into a two-way experience. This poll allows visitors to identify what matters most to them when choosing a home in New York, and the aggregated responses could be compared with rental, transportation, and neighborhood data. Because the poll only collects anonymous totals, it provides a lightweight form of participation without collecting personal or location information.

## Database Rules

The rules in `firebase-database.rules.json` allow public reading of anonymous vote records so the interface can aggregate them. Each record key must be a valid SHA-256 voting-code hash, its value must be one of the four named choices, and it can only be created once. Existing votes cannot be changed or deleted through the public website.
