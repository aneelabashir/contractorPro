const getProfile = async (req, res, next) => {
  const { Profile } = req.app.get("models");
  const profileId = req.get("profile_id") || 0;

  try {
    const profile = await Profile.findByPk(profileId);

    if (!profile) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.profile = profile;
    next();
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).end();
  }
};

module.exports = { getProfile };
