CAR-AGENTS

AI-Supported Backoffice System

1. What We Exactly Have

4 Contract Templates (all fields and placeholders known)

B2C Aktiv — contract used when CAR-AGENTS actively sells a client's car for them

Beschaffung Passiv — contract used when CAR-AGENTS is hired to find/buy a specific car for a client

Übergabeprotokoll — the vehicle handover checklist, signed when the car is physically handed over

Kaufvertrag C2C — the final purchase contract between the actual buyer and seller

Package Prices

Essential — €347

Advanced — €1,247

Concierge — €2,497

Business Info 

CAR-AGENTS, Maxim Lorenz, Lerchenweg 7, 93349 Mindelstetten, info@car-agents.de, +49 8404 9385840

2. What We Need From the Client for Phase 1

Two things are still missing before Phase 1 can be fully tested with real data:

Real Fahrzeugschein (Part 1 & 2) samples — so OCR extracts vehicle fields correctly

Note: What we currently have is a VW data card (Fahrzeugdatenträger — a small parts/spec reference card with VIN, engine code, paint code, used by dealers/mechanics), not an actual Fahrzeugschein (the official German vehicle registration document — like the car's ID card, issued by the government, has owner details, registration date, license plate, etc.). 

Why this matters: The Fahrzeugschein is what OCR reads to auto-fill vehicle details (registration date, license plate, etc.) into the 4 contracts. Without a real sample, this part can't be properly built/tested — those fields would need to be typed in manually instead of auto-filled.

Test drive agreement template — the 5th document to include in the engine (if needed in the final pipeline)

What We Will Build in Phase 1 (regardless)

OCR module — reads vehicle documents automatically

Document auto-fill engine — fills contracts automatically using OCR + basic inputs

AI listing generator — writes car listing text automatically

E-signature setup — lets contracts be signed via link, no PDF printing needed

OCR Module — Exact Fields It Will Extract

From the Fahrzeugschein, the OCR module will read and pull out:

VIN (vehicle identification number)

Make and model

First registration date

License plate number

Engine code

Fuel type

Gearbox type

Input Form — Fields Maxim/User Fills Manually

Not everything can come from a scanned document. These details don't exist on the Fahrzeugschein, so Maxim (the client) will type them into a simple form himself for each deal:

Client name, address, date of birth

ID type and ID number

Phone and email

Mileage and asking price

Package chosen — Essential / Advanced / Concierge

Storage option — A / B / C

Commission amount, order fee, third-party costs

Individual agreements (any special terms for that deal)

ZB II number (the registration certificate Part 2 number)

TÜV expiry date (vehicle inspection due date)

Previous owners count

Accident history and condition/defects

Fahrzeugschein Part 1 vs Part 2 

Fahrzeugschein is the official German vehicle registration document — think of it like the car's ID card. It has two separate parts:

Part 1 (Zulassungsbescheinigung Teil I) — stays inside the car at all times, used for daily driving/registration checks

Part 2 (Zulassungsbescheinigung Teil II) — kept safely by the owner, needed only for ownership transfer/sale

Test Drive Agreement 

This is a contract signed before a customer test-drives a car. It covers liability — who's responsible if damage happens during the test drive.

Why: The client mentioned this document is needed and should be auto-generated too, but never actually sent us the blank template. Without the real file (with its exact fields and wording), it can't be added to the document engine — it would simply be missing from the system until we receive it

Can We Fully Test Each Module?

A straight answer on whether each Phase 1 module can be completely tested or only partly built:

AI Listing Generator — NOT fully testable yet

We can write the code, but we cannot fully test it yet.

We need at minimum one real vehicle's complete data — mileage, price, condition, TÜV expiry, accident history — to generate a proper, realistic listing.

With only placeholder/dummy data, we can build the skeleton (the working structure) but not confirm the final output quality.

E-signature Setup — Yes

We create a DocuSign or HelloSign account ourselves

Connect it to the document engine

Auto-generate a signing link per contract

Are they free? No, not for real use. But testing is free.

DocuSign: Free trial only (no permanent free plan). Paid: $10–15/mo (Personal, too basic) → $40–65/mo (Business Pro, needed for API)

HelloSign: Free forever for testing + free plan (3 real signs/month). Paid: $75/mo (50 signs/month) → $250/mo (100 signs/month)

3. What We Can Actually Build in Phase 1 

This table shows exactly what each Phase 1 module does, what we already have to build it, and what's still missing before it can be tested with real client data.

#

What

What We Build Exactly

What We Have

What's Missing

1

OCR module

Upload vehicle registration photo → extract VIN, make, model, engine, color, registration date 

VW Fahrzeugdatenträger (data card) — NOT the actual Fahrzeugschein, just a similar-looking VIN/spec reference card 

Real Fahrzeugschein (Teil I & II) samples — the actual official registration document. Our current sample can't even be used to test registration date extraction, since that field doesn't exist on it 

2

Document auto-fill engine

OCR data + simple input form for missing fields (client name, mileage, price, package, storage option) → outputs filled PDF of all 4 contracts

All 4 templates with known fields

Real client & deal info (name, mileage, price, etc.) — using demo/placeholder data for now until real deal data comes in 

3

AI listing text generator

Vehicle fields → Claude/GPT API → ready German listing text for all 3 platforms

Partial vehicle specs only (VIN, engine code, model, paint code) from the VW data card — not a real Fahrzeugschein, so registration date, license plate, mileage, and condition are still missing 

Real complete data for at least 1 vehicle (mileage, price, condition, TÜV expiry, accident history) — without it, only a skeleton can be tested

4

E-signature setup

DocuSign/HelloSign account setup → generate signing link per contract instead of PDF attachment

Nothing needed from client

Buildable and testable now, zero client data needed

In simple words — what each row means:

OCR module: takes a photo of the registration document and pulls out car details automatically — no manual typing. Needs real sample documents to be accurate.

Document auto-fill engine: takes those details + a few missing bits (like price, mileage) and fills out all 4 contracts as ready PDFs.

AI listing generator: turns car details into a proper sales listing text, written in German, ready for all 3 platforms — code can be built now, but full testing needs at least one real vehicle's complete data (mileage, price, condition, TÜV expiry, accident history).

E-signature setup: replaces "print, sign, scan" with a simple click-to-sign web link.

4. All Phases — Data Dependencies & What Gets Built

Each phase depends on getting certain access/data from the client first. Here's what's needed at each stage, and why.

Phase

Needs From Client

What Gets Built

Phase 1

• Fahrzeugschein samples

• Test drive agreement template

• Form filled with real client/deal info to fill the contracts 

• OCR module → Document auto-fill engine → AI listing generator → E-signature setup.

Phase 2

• Meta Business Manager access

• Gewerbeanmeldung (business registration doc)

• Strato IMAP/SMTP credentials

• WhatsApp Business API (WABA) setup + landline OTP verification

• Email integration

• WhatsApp bot development with conversation logic

• End-to-end document flow tested with first real vehicle + client

Phase 3

• Google Drive access

• Both calendar accesses (main job + CAR-AGENTS)

• Platform logins (Kleinanzeigen, mobile.de, AutoScout24)

• CRM decision (which system to use)

• Google Drive auto-folder per vehicle + link in listing

• Two-way calendar sync

• Multi-platform listing posting

• CRM pipeline setup (deal stages, follow-up rules, manual override)

Phase 4

• Bank account access

• PSD2 access (bank transaction API permission)

• Real project data

• Bank API → auto-start project on payment received

• Automated dunning (3 reminders → suspend per §3 para. 5)

• Live margin dashboard per project

• Master Agent AI — single WhatsApp/voice control for everything

Phase 5

• Phases 1–4 stable and working

• A second franchise user to test with

• Multi-tenant architecture go-live

• White-label setup per franchise partner

• KPI tracking (sell time, idle time, conversion per package)