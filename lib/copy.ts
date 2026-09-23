// lib/copy.ts
// Centralized copy and terminology for the application

export const COPY = {
  // App name and tagline
  appName: "Academic Repository Manager",
  tagline: "Automate repository management",

  // Navigation
  nav: {
    addOrganization: "+ Add Organization",
    signOut: "Sign Out",
  },

  // Login page
  login: {
    title: "Academic Repository Manager",
    subtitle: "Automate repository management",
    features: [
      {
        icon: "🔗",
        title: "Create redemption links",
        description: "Generate shareable links for students",
      },
      {
        icon: "👥",
        title: "Manage teams automatically",
        description: "Teams and repositories created on demand",
      },
      {
        icon: "📊",
        title: "Track redemptions",
        description: "Monitor who has redeemed each link",
      },
    ],
    signInButton: "Sign in with GitHub",
    footer: {
      docs: "Documentation",
      github: "GitHub",
      support: "Support",
    },
  },

  // Dashboard
  dashboard: {
    title: "Redemption Links",
    createButton: "Create Redemption Link",
    noLinks: "No redemption links created yet.",
    stats: {
      totalLinks: "Total Links",
      activeLinks: "Active Links",
      totalRedemptions: "Total Redemptions",
      totalRepos: "Total Repositories",
      // Teams created under a single group-type link — shown
      // only in that link's analytics, not the "Total Links"
      // dashboard-wide stat above.
      teamsCreated: "Teams Created",
    },
  },

  // Link creation form
  linkForm: {
    title: "Create Redemption Link",
    sections: {
      details: "📋 Repository Details",
      access: "🔐 Access & Security",
      expiration: "📅 Expiration",
    },
    fields: {
      name: "Redemption Link Name",
      nameHelp: "Used to identify the redemption link",
      type: "Repository Type",
      typeHelp: "How students will access the repository",
      accessLevel: "Access Level",
      accessLevelHelp:
        "What permissions students receive",
      template: "Template Repository URL (optional)",
      templateHelp: {
        solo:
          "Each student's repository is generated from " +
          "this template. Leave blank for an empty " +
          "repository.",
        group:
          "Each team's repository is generated from this " +
          "template. Leave blank for an empty repository.",
        coursedocs:
          "The shared repository is generated from this " +
          "template when the link is created. Leave " +
          "blank for an empty repository.",
      },
      maxTeamSize: "Max Team Size",
      maxTeamSizeHelp: "Leave blank for unlimited team size",
      maxGroups: "Max Number of Groups",
      maxGroupsHelp:
        "Leave blank for unlimited teams",
      expiresIn: "Expires In (days) - Optional",
      expiresInHelp:
        "1–365 days, or leave blank for no expiration",
    },
    repositoryTypes: {
      solo: "Solo",
      group: "Group",
      coursedocs: "Coursedocs",
    },
    accessLevels: {
      read: "Read",
      write: "Write",
      admin: "Admin",
    },
    adminWarning: {
      title: "⚠️ Admin access warning",
      message:
        "Students with admin access can delete or make " +
        "repositories public, depending on your " +
        "organization's settings.",
      settings: [
        "Members can change repository visibility",
        "Members can delete repositories",
        "Members can transfer repositories",
      ],
      configLink: "Configure org settings →",
    },
    coursedocsInfo:
      "A private repository and a team will be created " +
      "now. Every student who redeems the link joins " +
      "that team and gets read access to the same " +
      "repository.",
    submitButton: "Create Redemption Link",
    success: "Redemption link created successfully!",
  },

  // Link card
  linkCard: {
    copyUrl: "Copy URL",
    copied: "Copied!",
    deactivate: "Deactivate",
    activate: "Activate",
    delete: "Delete",
    deleteConfirm:
      "Delete this link permanently? Links with " +
      "redemptions cannot be deleted and must be " +
      "deactivated instead.",
    deleteConfirmCoursedocs:
      "The shared repository will be archived and " +
      "renamed to free the name.",
    shareText: "Share this link with students",
    analytics: "Analytics",
    showAnalytics: "Show Analytics",
    hideAnalytics: "Hide Analytics",
    type: "Type",
    accessLevel: "Access Level",
    created: "Created",
    status: "Status",
    active: "Active",
    inactive: "Inactive",
    expires: "Expires",
    maxTeamSize: "Max team size",
    maxGroups: "Max groups",
    created_count: "created",
    sharedAccess:
      "All students join the same team and repository " +
      "with read-only access.",
  },

  // Redemption page
  redeem: {
    joinOrg: {
      title: "Join Organization",
      message:
        "You need to join the organization on GitHub " +
        "before you can redeem this link.",
      sendInvitation: "Send Invitation",
      sendingInvitation: "Sending invitation...",
      acceptInvitation: "Accept Invitation on GitHub →",
      alreadyPending:
        "You already have a pending invitation to this " +
        "organization. Click the link below to accept it:",
      afterAccept:
        "After accepting the invitation, click the " +
        "button below to continue.",
      continue: "Continue",
      checking: "Checking membership...",
      notMember:
        "You are still not a member. Please accept the " +
        "invitation on GitHub.",
      note: "You will only have access to repositories that " +
        "your instructor explicitly adds you to. The " +
        "organization will not give you any other " +
        "permissions.",
    },
    solo: {
      title: "Create Your Repository",
      slugLabel: "Repository Name Suffix (optional)",
      slugPlaceholder:
        "Leave blank to use your GitHub username",
      slugHelp: "Your repository name will be:",
      createButton: "Create Repository",
      creating: "Creating repository...",
    },
    group: {
      joinTeam: "Join a Team",
      createTeam: "Create a New Team",
      noTeamsAvailable: "No teams available to join.",
      noTeamsMax:
        "No teams have open spots. Please contact your " +
        "instructor.",
      teamNameLabel: "Team Name",
      teamNamePlaceholder: "e.g., Team A, Group 1",
      expectedSizeLabel: "Expected Team Size",
      maxAllowed: "Maximum allowed by instructor:",
      joinButton: "Join Team",
      joining: "Joining...",
      createButton: "Create Team",
      creating: "Creating team...",
      members: "members",
    },
    coursedocs: {
      title: "Get Access to Course Documents",
      message:
        "Click below to join the course team and gain " +
        "access to the shared repository.",
      getAccessButton: "Get Access",
      granting: "Granting access...",
    },
    success: {
      title: "Repository Created!",
      alreadyRedeemed: "Repository Access Confirmed",
      coursedocsTitle: "Access Granted!",
      message:
        "Your repository has been created and you have " +
        "been added as a collaborator.",
      alreadyRedeemedMessage:
        "You already have access to this repository.",
      coursedocsMessage:
        "You have been added to the course team with " +
        "read access to the shared repository.",
      repoName: "Repository Name",
      cloneCommand: "Clone Command",
      viewOnGithub: "View on GitHub →",
      nextSteps: "Next steps:",
      nextStepsItems: [
        "Clone the repository",
        "Complete your work",
        "Push your changes to GitHub",
      ],
      nextStepsCoursedocs: [
        "Clone the repository using the command above",
        "Run git pull regularly for updates",
      ],
    },
  },

  // Errors
  errors: {
    unauthorized: "Unauthorized",
    forbidden: "Forbidden",
    notFound: "Not found",
    serverError: "An unexpected error occurred",
    failedToFetch: "Failed to fetch",
    failedToCreate: "Failed to create",
    failedToUpdate: "Failed to update",
    failedToDelete: "Failed to delete",
  },
};

export type Copy = typeof COPY;
