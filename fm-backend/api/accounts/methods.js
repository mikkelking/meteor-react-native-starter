import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
import { check, Match } from "meteor/check";
import { NotSignedInError } from "../errors/NotSignedInError";
import { PermissionDeniedError } from "../errors/PermissionDeniedError";

/** @module accounts/methods */

/**
 * Registers a new user by email+password and minimal profile fields.
 *
 * @methodOf {accounts/methods}
 * @function
 * @example
 * registerNewUser({
 *   email: janedow@example.com,
 *   password: 'mysupersecretpw',
 *   firstName: 'Jane',
 *   lastName: 'Doe',
 *   loginImmediately: true
 * })
 *
 *
 * @param options {object}
 * @param options.email {string}
 * @param options.password {string}
 * @param options.firstName {string}
 * @param options.lastName {string}
 * @param options.loginImmediately {boolean} if true performs a login after account creation
 * @return {Object<{ id: string, token: string=, tokenExpires: Date= }>} object with at least the _id of the created user and
 *   optionally the token and tokenExpires values when user is logged in immediately
 */
export const registerNewUser = async function (options) {
  check(
    options,
    Match.ObjectIncluding({
      email: String,
      password: String,
      firstName: String,
      lastName: String,
      loginImmediately: Match.Maybe(Boolean),
    })
  );

  const { email, password, firstName, lastName, loginImmediately } = options;

  const user = await Accounts.findUserByEmail(email);
  if (user) {
    throw new PermissionDeniedError("accounts.userExists", { email });
  }

  const userId = await Accounts.createUser({ email, password });

  // we add the firstName and lastName as toplevel fields
  // which allows for better handling in publications
  await Meteor.users.updateAsync(userId, { $set: { firstName, lastName } });

  // let them verify their new account, so
  // they can use the full app functionality
  await Accounts.sendVerificationEmail(userId, email);

  if (loginImmediately) {
    // signature: { id, token, tokenExpires }
    return Accounts._loginUser(this, userId);
  }

  // keep the same return signature here to let clients
  // better handle the response
  return { id: userId, token: undefined, tokenExpires: undefined };
};

/**
 * Updates the user profile fields
 *
 * @methodOf {accounts/methods}
 * @function
 * @example
 * updateUserProfile({ firstName: 'Jane', lastName: 'Doe' })
 *
 * @param firstName {string=}
 * @param lastName {string=}
 * @return {boolean} true if updated, otherwise false
 */
export const updateUserProfile = function ({ firstName, lastName }) {
  check(firstName, Match.Maybe(String));
  check(lastName, Match.Maybe(String));

  // in a meteor Method we can access the current user
  // via this.userId which is only present when an
  // authenticated user calls a Method
  const { userId } = this;

  if (!userId) {
    throw new NotSignedInError({ userId });
  }

  const updateDoc = { $set: {} };

  if (firstName) {
    updateDoc.$set.firstName = firstName;
  }

  if (lastName) {
    updateDoc.$set.lastName = lastName;
  }

  return !!Meteor.users.update(userId, updateDoc);
};

/**
 * Deletes the current user. Works only for the user who invoked this method!
 *
 * @methodOf {accounts/methods}
 * @function
 * @example
 * deleteAccount()
 *
 * @return {boolean} true if removed else false
 */
export const deleteAccount = function () {
  const { userId } = this;

  if (!userId) {
    throw new NotSignedInError({ userId });
  }

  return !!Meteor.users.remove(userId);
};
