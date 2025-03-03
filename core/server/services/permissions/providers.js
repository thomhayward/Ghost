const _ = require('lodash');
const Promise = require('bluebird');
const models = require('../../models');
const common = require('../../lib/common');

module.exports = {
    user: function (id) {
        return models.User.findOne({id: id, status: 'active'}, {withRelated: ['permissions', 'roles', 'roles.permissions']})
            .then(function (foundUser) {
            // CASE: {context: {user: id}} where the id is not in our database
                if (!foundUser) {
                    return Promise.reject(new common.errors.NotFoundError({
                        message: common.i18n.t('errors.models.user.userNotFound')
                    }));
                }

                const seenPerms = {};

                const rolePerms = _.map(foundUser.related('roles').models, function (role) {
                    return role.related('permissions').models;
                });

                const allPerms = [];
                const user = foundUser.toJSON();

                rolePerms.push(foundUser.related('permissions').models);

                _.each(rolePerms, function (rolePermGroup) {
                    _.each(rolePermGroup, function (perm) {
                        const key = perm.get('action_type') + '-' + perm.get('object_type') + '-' + perm.get('object_id');

                        // Only add perms once
                        if (seenPerms[key]) {
                            return;
                        }

                        allPerms.push(perm);
                        seenPerms[key] = true;
                    });
                });

                // @TODO fix this!
                // Permissions is an array of models
                // Roles is a JSON array
                return {permissions: allPerms, roles: user.roles};
            });
    },

    apiKey(id) {
        return models.ApiKey.findOne({id}, {withRelated: ['role', 'role.permissions']})
            .then((foundApiKey) => {
                if (!foundApiKey) {
                    throw new common.errors.NotFoundError({
                        message: common.i18n.t('errors.models.api_key.apiKeyNotFound')
                    });
                }

                // api keys have a belongs_to relationship to a role and no individual permissions
                // so there's no need for permission deduplication
                const permissions = foundApiKey.related('role').related('permissions').models;
                const roles = [foundApiKey.toJSON().role];

                return {permissions, roles};
            });
    }
};
