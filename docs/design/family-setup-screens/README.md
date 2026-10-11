# Family set-up screens (approved mock-ups)

Reference only, not app code. Each file is one phone screen (390 x 844) with inline styles and the exact copy.
The owner approved **Look 1** for the first screen and **Flow A** (own email and password).

| File | Screen | Notes for the build |
|---|---|---|
| `Main.dc.html` | First screen | Two buttons: create an account, sign in. |
| `CreateAccount.dc.html` | Create your account | Name, email, password (min 8). |
| `EnterCode.dc.html` | Check your email | Layout for the 6-digit code. For sign-up the button reads "Continue" and the text says "to finish creating your account"; reuse the layout for password reset. |
| `WhoAreYouCaringFor.dc.html` | Who are you caring for? | Use the heading, field and button. Drop the "I already have an account" link and the "Next you will create your account" line: this screen comes after sign-up. |
| `WhoElseHelps.dc.html` | Who else helps? | Each added email shows a Share action for the invite message. |
| `SignIn.dc.html` | Welcome back | Email, password, forgot password. |

Tokens used: ground `#faf7f2`, text `#26201a`, secondary text `#4a4238` / `#6f665b`, accent `#8a6240`, card border `#e9e2d6`, field border `#b9ae9c`, primary button `#26201a` on white text, radius 14 (fields, buttons) and 16 (cards), DM Serif Display for headings, DM Sans for everything else.
