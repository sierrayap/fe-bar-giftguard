# GiftGuard script

Read this out loud, top to bottom. It is written for 15 to 20 minutes if you speak at a normal demo pace and pause on the [brackets]. Words in [brackets] are what you do, not what you say. Do not skip the pauses.

Have these open before you start:
- App: https://fe-bar-giftguard-fraud-ops-7474656648208740.aws.databricksapps.com
- Workspace: https://fevm-sierra-yap-demo-dump.cloud.databricks.com/?o=7474656648208740
- Genie space: fe-bar GiftGuard Fraud Analytics
- Catalog Explorer on sierra_yap_demo_dump_catalog, fe-bar-gold

---

Thanks for the time. I want to keep this practical, and I want both of you in this.

[Look at the business person, then the technical person.]

If you are the one funding this, I am going to talk about dollars stopped, how many good customers we bother, and what a fraud team actually does with a case. If you are the one who has to run it, I am going to show you the path from a raw file to a score, and I am not going to hide what is batch versus what is live.

The customer here is a digital gift card platform. Think Prezzee. People buy a Bunnings card or a Woolies card, it sits in an account, they redeem it. From a fraud point of view those cards are cash. Stolen cards, account takeovers, people buying a stack of max denomination cards and dumping them. You do not catch it at the till. You catch it weeks later as a chargeback, a merchant penalty, and a queue your analysts are working by hand.

That is the problem I built against. Not a generic improve operations story. A specific one: stop bad gift card orders at purchase, without blocking the person who is just buying a birthday card.

What I am going to show you is one connected flow. Raw orders land. They get cleaned and governed. A model scores every order. Flagged ones go to a review console with a one line reason. And if a manager wants to ask a question, they ask it in English, they do not raise a ticket.

I will use numbers from a real run on this workspace, not from a slide. So you can check me.

Headline first so you know where we are landing. We scored 100,298 orders. The model allowed 93,819 straight through. It sent 4,140 to review, that is 100,485 dollars of face value. It blocked 2,339, that is 348,380 dollars of face value. Of that blocked amount, 226,100 dollars is labeled fraud. There is 237,185 dollars of labeled fraud in the whole set, so the block step alone got most of the money. About 80 percent of the fraud orders got caught at review or block.

I will walk one order end to end, then we can pull it apart.

[Open the Fraud-Ops app. Pause two seconds so they can see the page.]

Let me start where your fraud team would start their day, not in a notebook.

These cards at the top are KPIs off the gold tables. Fraud rate, dollars blocked, false positive rate, cases open. I am not going to linger here, because the interesting bit is the queue.

This table is the work. Every row is a flagged order. Score, brand, face value, and a short summary of why it got flagged. An analyst can scan this without opening a spreadsheet.

I will open the top one.

[Click the top order. Prefer ord-00098728 if it is there. Pause while the case loads.]

This is order 98728. Score 0.995. Decision is block. Brand is Bunnings, face value 500 dollars. That is a max denomination card, which is a thing we look at.

This paragraph here is the case summary. I did not type that. The job wrote it with ai_query. Instead of dumping velocity counts at the analyst, they get a sentence. This one is saying the same account put through ten orders in the last hour, and ten in the last 24 hours. That is a burst. Someone can act on that in a few seconds.

Under that you have the features. Account age, velocity, how many accounts share the device, whether the IP country matches the account country. Those are the same features the model used. So if the analyst disagrees with the score, they can see why it fired.

From here they can approve, block, or escalate. That decision gets written back. We keep a record. We do not lose it in a Slack thread.

So that is the payoff. A person in fraud ops, morning coffee, working a queue of the stuff that actually needs a human. Now let me show you what is feeding it, because none of this is a mock-up.

[Open Catalog Explorer on the fe-bar-raw volume. Pause.]

Raw events land here, in a Unity Catalog volume. Customers, brands, orders, redemptions, chargebacks. This run is synthetic. No real customer records. I generated about 5,000 customers and about 100,000 orders, with the fraud patterns you would actually see. Velocity bursts like that Bunnings order. Shared devices across accounts. IP country not matching the account. Brand new accounts going straight for a 500 dollar card.

I am saying that out loud because I do not want anyone thinking I trained a model on production PII. I did not.

[Open the fe-bar-fraud-pipeline graph. Pause so they can see bronze, silver, gold.]

This is the Lakeflow pipeline. It picks those files up with Auto Loader. Bronze is streaming tables. Silver and gold are materialized views. Data quality checks sit on the way through, so a broken record dies before it gets near the model.

I am going to be honest about the shape. Bronze is streaming. Silver and gold are batch views. I did that on purpose. The velocity features are windowed counts, and those are simpler and correct as batch. Streaming them would add state and cost and would not change the result for this use case.

The point for you is the score is only as good as the data under it. This is where we make sure it is clean, and where one order can be followed from a file to a table.

[Open gold fe-bar-card-risk-scores. Show column comments if they are visible. Show masks on email, IP, card last four. Open Lineage.]

Everything sits in Unity Catalog. Same catalog, same names, so we are not copying data into a side system to do analytics.

Email, IP, and card last four are masked unless you are in fraud ops. Everyone else sees a masked value. The app and Genie go through the same permissions. There is no side door.

Lineage here is the audit answer. If risk asks where a block decision came from, you can walk from the gold score back to the raw file. That is a conversation you want to be able to have in five minutes, not three weeks.

[Open the fe-bar-fraud-classifier model in Unity Catalog, then the MLflow experiment if you have it. Pause.]

The model is gradient boosted trees. XGBoost, trained on the gold features, tracked in MLflow, registered in Unity Catalog as fe-bar-fraud-classifier. I am watching precision-recall, not accuracy. Fraud is about 1.5 percent of orders. If I quoted accuracy it would look brilliant and tell you nothing.

A thing I left out on purpose: chargebacks. Chargebacks show up weeks after the order. If I put them in the model, it would look like a genius at training time and be useless at checkout. So they are not a feature.

Here is what the model did on the full set. 100,298 orders. 93,819 allowed. 4,140 review. 2,339 block.

Of the 1,532 orders labeled as fraud, about 80 percent got caught at review or block.

On dollars: 348,380 blocked, and 226,100 of that is labeled fraud. Review is another 100,485 sitting with a person.

On the case summaries, I generated 40 for this run, the top of the queue. In production you would run that on everything that lands in review. It is the same prompt, same model, just more rows.

I used two bands on purpose. Block is the high confidence band. Review is the grey area. That is so we are not declining a real customer on a 0.4 score. Most of the false flags go to review, not a hard decline.

The number I would sit on with you is the false flags. About 5 percent of legitimate orders got sent to review or block. If that is too high, we move the threshold. You trade a bit of fraud catch for fewer good customers in the queue. That is a business decision. I can show you the table. It is not a rebuild.

[Open the Lakebase project fe-bar-giftguard-serving. Pause.]

At checkout you cannot scan a gold table. You need one row, by order ID, fast. So the flagged scores get loaded into Lakebase. That is Postgres.

I looked up this same order, 98728, and got the score back in 414 milliseconds. That is from my laptop in Sydney to a US region over the internet. In region, next to checkout, it will be tighter.

I will also be straight about what this is. In this workspace I loaded the table from gold with a job. I could not create a synced catalog here. In your account I would use a synced table so it stays current without that step.

Delta is for analytics and training. Lakebase is for the app and for checkout. Same data, different engine, on purpose.

[Open the Genie space fe-bar GiftGuard Fraud Analytics.]

Your fraud manager is not going to write SQL. I am not going to pretend they will. So I am going to ask this in English.

[Type: How much face value did we block versus review? Wait for the answer. Do not talk over it.]

348,380 blocked, 100,485 to review. Same numbers I just told you off the gold table. It is reading the governed tables. It cannot see anything the person asking is not allowed to see.

That question would normally be a ticket to analytics and a couple of days. Here it is a sentence.

I will do one more, because this is the kind of thing they actually ask.

[Type: Show the top 10 highest-value blocked orders. Wait.]

These are the expensive blocks. Brand, face value, score. If a manager wants to know whether we are blocking a lot of 20 dollar cards or a lot of 500 dollar cards, they get it here.

[Go back to the app. Point at the Genie panel inside the console.]

And the same Genie is in the console. The analyst does not leave the app to ask a question, then come back and lose their place.

So let me say the loop once, slowly, because this is the whole point of the build.

An order is placed. The event lands in the volume. The pipeline lands it in bronze, cleans it in silver, and builds features in gold. The model scores it. If it is boring, it is allowed. If it is ugly, it is blocked, and the score is sitting in Lakebase for a fast lookup. If it is grey, it lands in this queue with a sentence explaining why. If someone wants the weekly picture, they ask Genie.

That is one journey. It is not six disconnected demos.

To bring it back to what you care about.

On this data the block step caught 226,000 of the 237,000 dollars in labeled fraud. Review caught more on top of that. Analysts are looking at the grey area, not at everything.

The thing I would tune with you first is those false flags. About 5 percent of good orders in review or block. Most of that is review. I would rather you argue with me about that number than argue about whether the pipeline exists.

If I scale this to a real book, say a 500 million dollar GMV platform losing around 4 million a year to this kind of fraud, the modeled saving at a more conservative catch rate is about 2.4 million a year. I want to be clear. That is a model. It is not this table. The numbers I will stand on in this room are the ones from the run.

What I would do next is a two to four week pilot on a slice of your real order history. We keep it in shadow. It scores, it does not decline anyone. We sit with your fraud lead, we pick a threshold, we see how the queue looks. Then we talk about putting it in front of a customer.

I am going to name two things this is not, so we do not waste time later.

It is not real-time scoring today. Scoring is batch, then we load Lakebase. For checkout you would put this model behind Model Serving. The model is already in Unity Catalog, so that is a deploy, not a rebuild.

And I did not stand up a Model Serving endpoint in this workspace. I am not going to show you one.

Happy to go into cost, the architecture, or how we would plug this into your order feed.

[Stop. Let them talk.]

---

If they want the short version, read this instead:

Gift cards are cash, so fraud is expensive. We score every order, block the obvious fraud, send the grey area to a review queue, and give the analyst a one-line reason for each case. On about 100,000 orders we blocked 348,000 dollars, and 226,000 of that was confirmed fraud. 80 percent of fraud orders got caught somewhere. The thing to tune with you is how many good customers end up in review. That is a dial, not a rebuild.

If the architect wants the short technical version:

Raw JSON lands in a Unity Catalog volume. A Lakeflow pipeline uses Auto Loader into bronze streaming tables, then silver and gold materialized views with expectations. Gold features feed an XGBoost classifier tracked in MLflow and registered in UC. A job batch scores gold, writes decisions and ai_query case summaries back to a gold table. PII columns are masked in UC. Flagged scores load into a Lakebase Postgres table for point lookups. Genie sits on the gold tables. The app is a Databricks App reading the warehouse and Lakebase. Everything is in an asset bundle, so it redeploys the same way every time.

---

If they ask about cost, say:

It is all serverless, so you pay for what runs. The pipeline and scoring are batch, so a few minutes a run. Lakebase scales down when it is quiet. I would size it properly off your volumes in the pilot rather than guess today.

If they ask how many good customers you annoy, say:

Fair question. On this run about 5 percent of legitimate orders went to review or block. Most of those went to review, so a person looks before anything is declined. If that is too high we move the threshold. You trade a bit of fraud catch for fewer good customers flagged, and we can show you exactly what each setting costs.

If they ask how sure you are about the 2.4 million, say:

I am not quoting that as a result. That is a model on a 4 million dollar fraud book. What I can stand behind today is this run: 226,000 of 237,000 dollars in fraud stopped at the block step. The pilot on your data is how we turn the model into your number.

If they ask how long until it is live, say:

The pattern is already here. The work is plugging in your order feed and agreeing the threshold. I would say a few weeks for a pilot on history, then a shadow period where it scores live but does not block, before it touches a real customer.

If they ask if this is actually real-time, say:

Not yet, and I will not pretend it is. Today scoring is batch and the results get loaded into Lakebase for fast lookup. For real-time at checkout you would put the model behind a Model Serving endpoint and call it on each order. The model is already in UC, so that is a deployment step, not a rebuild.

If they ask why Lakebase and not just Delta, say:

Delta is built for scans and aggregates. Checkout needs one row by order ID in milliseconds. Lakebase gives you Postgres for that. In this workspace I loaded the table from gold with a job. In your account I would use a synced table so it stays current without that step.

If they ask about data quality, say:

Expectations in the pipeline drop bad records before scoring. And I left chargebacks out of the model features on purpose, because they show up weeks after the order. Training on them would look brilliant and be useless at checkout.

If they ask about security and PII, say:

Column masks in Unity Catalog on email, IP and card last four. Only the fraud ops group sees the real values. Genie and the app go through the same permissions, so there is no side door.

If they ask about drift, say:

Labels and scores land back in gold, so retraining is a scheduled job. I would watch precision-recall each week and only promote a new version in UC if it beats the current one.

If they ask why not one big streaming pipeline, say:

Bronze is streaming with Auto Loader. Silver and gold are materialized views because the windowed features are simpler and correct as batch. Streaming those would add state and cost without changing the result for this use case.
