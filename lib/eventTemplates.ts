export interface EventMeta {
    slug: string;
    title: string;
    shortTitle: string;
    date: string;          // e.g. "Saturday, September 19, 2026"
    dateShort: string;     // e.g. "Sep 19"
    time: string;          // e.g. "12:00 PM – 4:00 PM"
    venueName: string;
    venueAddress: string;  // full address, may include newlines
    active: boolean;
}

export interface EmailTemplate {
    id: string;
    label: string;
    subject: string;
    body: (firstName: string) => string;
}

export function buildEmailTemplates(event: EventMeta): EmailTemplate[] {
    const { title, shortTitle, date, dateShort, time, venueName, venueAddress } = event;

    return [
        {
            id: "guestlist-confirmed",
            label: "Guestlist Confirmed",
            subject: `Registration Confirmed — ${title} ${dateShort}`,
            body: (name) => `Hello ${name},\n\nThank you for registering for the ${title}. Your registration has been confirmed, and we're looking forward to seeing you there!\n\nDate: ${date}\nTime: ${time}\nLocation:\n${venueName}\n${venueAddress}\n\nDance Requests\n\nYou may submit up to 10 line dance requests for the social. To submit your requests, simply reply to this email, or sign in to your account at beyondlinedance.com and click the update requests button from the home page.\n\nIf you have any questions before the event, simply reply to this email.\n\nWe look forward to dancing with you!\n\nBest,\nStephen`,
        },
        {
            id: "waitlist",
            label: "Waitlist Notice",
            subject: `Waitlist — LDCO ${shortTitle} ${dateShort}`,
            body: (name) => `Hi ${name},\n\nThank you for registering for the LDCO ${title} on ${date}!\n\nWe've reached capacity, but you're on the waitlist. We'll reach out as soon as a spot opens up.\n\nStephen`,
        },
        {
            id: "reminder",
            label: "Reminder",
            subject: `Reminder: LDCO ${shortTitle} — ${date}`,
            body: (name) => `Hi ${name},\n\nJust a reminder that the LDCO ${title} is coming up!\n\nDate: ${date}\nTime: ${time}\nLocation:\n${venueName}\n${venueAddress}\n\nLooking forward to seeing you there!\n\nStephen`,
        },
        {
            id: "requests-deadline",
            label: "Requests Deadline",
            subject: `Last Day for Dance Requests — ${shortTitle} ${dateShort}`,
            body: (name) => `Hello ${name},

Just a quick reminder — today is the last day to submit or update your dance requests for the ${title} on ${date}!

You may submit up to 10 requests. I'll be putting together the Guaranteed Dance List tomorrow, so make sure your picks are in by end of day.

To submit or update your requests, you have two options:

  1. Reply directly to this email with your list
  2. Sign in at beyondlinedance.com using the same email you registered with, then click the Update Requests button on the home page

If you don't have an account yet, you can create one — just use the same email address you registered with and you'll be linked up automatically.

Looking forward to a great event — see you on the dance floor!

Best,
Stephen`,
        },
        {
            id: "one-week-out",
            label: "One Week Out",
            subject: `One Week Away — ${shortTitle} ${dateShort}`,
            body: (name) => `Hello ${name},

We're just one week away from the ${title}, and I'm so excited to see everyone there!

Here's a quick reminder of the details:

Date: ${date}
Time: ${time}
Location:
${venueName}
${venueAddress}

Food

To make this first event extra special, I'm having it catered by Brother's BBQ! If you have any dietary restrictions or allergies, please reply to this email and let me know so I can plan accordingly. Outside food is welcome if you'd like to bring something of your own.

Guaranteed Dance List

The Guaranteed Dance List has been published! Check out the dances we'll be doing at:

  https://beyondlinedance.com/events/intermediate-social/guaranteed-list

I can't wait to hit the dance floor with all of you — see you next Saturday!

Best,
Stephen`,
        },
        {
            id: "day-before",
            label: "Day Before",
            subject: `See You Tomorrow — ${shortTitle} ${dateShort}`,
            body: (name) => `Hello ${name},

The big day is almost here — the ${title} is tomorrow!

Date: ${date}
Time: ${time}
Location:
${venueName}
${venueAddress}

The Guaranteed Dance List is published and ready to view at:

  https://beyondlinedance.com/events/intermediate-social/guaranteed-list

We'll have catering from Brother's BBQ on site. If you have any last-minute questions, just reply to this email.

Can't wait to see you on the dance floor tomorrow!

Best,
Stephen`,
        },
        {
            id: "post-event-feedback",
            label: "Feedback Request",
            subject: `How was the ${shortTitle}? — We'd love to hear from you`,
            body: (name) => `Hello ${name},

Thank you so much for joining us at the ${title} on ${date} — it was such a great day on the dance floor, and we hope you had as much fun as we did!

We'd love to hear what you thought. Your feedback helps us make each event better than the last.

A few questions to get you started — feel free to answer any or all:

  • What did you enjoy most about the event?
  • Is there anything you'd like to see done differently next time?
  • How did you feel about the venue, the music, and the dance selection?
  • Would you come back for another LDCO event?

Just hit reply — even a few sentences would mean a lot to us.

Thanks again for being part of the LDCO community. We hope to see you on the dance floor again soon!

Best,
Stephen`,
        },
        {
            id: "next-event-promo",
            label: "Next Event Promo",
            subject: `Two weeks later — your thoughts + save November 21st!`,
            body: (name) => `Hello ${name},

It's been two weeks since the ${title} and it was a great time. I hope you enjoyed it as much as I did!

Your Feedback

Before I dive into the exciting news, I'd love to hear how you felt about the event. Even a few sentences would go a long way:

  • What did you enjoy most?
  • Anything you'd change for next time?
  • How did you feel about the venue, music, and dance selection?

Just hit reply — your feedback directly shapes what we do next.

Save the Date: November 21st at the Turnverein

I'm thrilled to announce that the next LDCO Intermediate Social is on Saturday, November 21st at the Denver Turnverein!

Registration is $20, and there's an optional BBQ catering add-on for $15 (total: $35 with catering).

Register at: https://beyondlinedance.com/events/intermediate-social

Dance Requests

Once you're registered, you can submit up to 10 dance requests and update them anytime you like up until two weeks before the event. The most-requested dances make it onto the Guaranteed Dance List, so the more people request, the better the floor.

If you're attending Dance Magic, this is your chance to put those fresh dances to work — add anything new you pick up and I'll make sure it's in the mix on November 21st.

Looking forward to dancing with you again soon!

Best,
Stephen`,
        },
        {
            id: "custom",
            label: "Custom",
            subject: `LDCO ${shortTitle} — ${dateShort}`,
            body: (name) => `Hi ${name},\n\n`,
        },
    ];
}
