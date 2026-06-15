const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const User = require('../models/User');
const { TokenBlacklist } = require('../models/TokenBlacklist');
const linkNonces = require('../services/linkNonceService');

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_ACCESS_SECRET,
      passReqToCallback: true,
    },
    async (req, payload, done) => {
      try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace('Bearer ', '');
        const blacklisted = await TokenBlacklist.findOne({ token });
        if (blacklisted) return done(null, false);

        const user = await User.findById(payload.sub).select('-passwordHash');
        if (!user || !user.isActive) return done(null, false);
        return done(null, user);
      } catch (err) {
        return done(err, false);
      }
    }
  )
);

passport.use(
  new GoogleStrategy(
    {
      clientID:          process.env.GOOGLE_CLIENT_ID,
      clientSecret:      process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:       process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // ── Link mode ─────────────────────────────────────────────────────
        // A short-lived httpOnly cookie is set when an authenticated user
        // initiates the "Connect Google" flow from their profile page.
        const linkNonce = req.cookies?.google_link_nonce;
        if (linkNonce) {
          const userId = linkNonces.consume(linkNonce);
          if (!userId) {
            // Nonce expired or already used — flag as link failure
            req._googleLinkError = 'LINK_EXPIRED';
            return done(null, false);
          }

          const targetUser = await User.findById(userId);
          if (!targetUser) {
            req._googleLinkError = 'USER_NOT_FOUND';
            return done(null, false);
          }

          req._googleLinkUser = targetUser; // expose role for redirect decision in callback handler

          // Reject if this Google account is already linked to a different user
          const alreadyLinked = await User.findOne({ googleId: profile.id });
          if (alreadyLinked && String(alreadyLinked._id) !== String(targetUser._id)) {
            req._googleLinkError = 'GOOGLE_ALREADY_LINKED';
            return done(null, false);
          }

          targetUser.googleId      = profile.id;
          targetUser.googleEmail   = profile.emails?.[0]?.value ?? null;
          targetUser.googleName    = profile.displayName ?? null;
          targetUser.googlePicture = profile.photos?.[0]?.value ?? null;
          await targetUser.save();
          req._googleLinked = true; // signal success to the route handler
          return done(null, targetUser);
        }

        // ── Normal login / auto-register ──────────────────────────────────
        const googleEmail   = profile.emails?.[0]?.value ?? null;
        const googleName    = profile.displayName ?? null;
        const googlePicture = profile.photos?.[0]?.value ?? null;

        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
          user = await User.findOne({ email: googleEmail });
          if (user) {
            user.googleId      = profile.id;
            user.googleEmail   = googleEmail;
            user.googleName    = googleName;
            user.googlePicture = googlePicture;
            await user.save();
          } else {
            user = await User.create({
              name:          googleName,
              email:         googleEmail,
              googleId:      profile.id,
              googleEmail,
              googleName,
              googlePicture,
              role: 'guest',
            });
          }
        } else {
          // Refresh Google profile data on every login
          user.googleEmail   = googleEmail;
          user.googleName    = googleName;
          user.googlePicture = googlePicture;
          await user.save();
        }
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);
