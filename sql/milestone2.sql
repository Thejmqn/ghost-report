---- Create Tables ----

CREATE TABLE User (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(32),
    password VARCHAR(64),
    email VARCHAR(128)
);

CREATE TABLE Ghost_Buster (
    userID INT PRIMARY KEY,
    ghosts_busted INT,
    alias VARCHAR(32),
    FOREIGN KEY (userID) REFERENCES User(id)
);

CREATE TABLE Sighting (
    id INT AUTO_INCREMENT PRIMARY KEY,
    visibility INT,
    time DATETIME,
    userReportID INT,
    latitude DECIMAL(11, 8),
    longitude DECIMAL(11, 8),
    FOREIGN KEY (userReportID) REFERENCES User(id)
);

CREATE TABLE Ghost (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(32),
    name VARCHAR(32),
    description VARCHAR(512),
    visibility INT
);

CREATE TABLE Tour (
    id INT AUTO_INCREMENT PRIMARY KEY,
    startTime DATETIME,
    endTime DATETIME,
    guide VARCHAR(32),
    path TEXT
);

CREATE TABLE Sighting_Comment (
    userID INT,
    sightingID INT,
    reportTime DATETIME,
    description varchar(512),
    PRIMARY KEY (userID, sightingID),
    FOREIGN KEY (userID) REFERENCES User(id),
    FOREIGN KEY (sightingID) REFERENCES Sighting(id)
);

CREATE TABLE Ghost_Comment (
    userID INT,
    ghostID INT,
    reportTime DATETIME,
    description varchar(512),
    PRIMARY KEY (userID, ghostID),
    FOREIGN KEY (userID) REFERENCES User(id),
    FOREIGN KEY (ghostID) REFERENCES Ghost(id)
);

CREATE TABLE Sighting_Reports_Ghost (
    sightingID INT,
    ghostID INT,
    PRIMARY KEY (sightingID, ghostID),
    FOREIGN KEY (sightingID) REFERENCES Sighting(id),
    FOREIGN KEY (ghostID) REFERENCES Ghost(id)
);

CREATE TABLE Tour_Includes (
    tourID INT,
    ghostID INT,
    PRIMARY KEY (tourID, ghostID),
    FOREIGN KEY (tourID) REFERENCES Tour(id),
    FOREIGN KEY (ghostID) REFERENCES Ghost(id)
);

CREATE TABLE Tour_Sign_Up (
    userID INT,
    tourID INT,
    PRIMARY KEY (userID, tourID),
    FOREIGN KEY (userID) REFERENCES User(id),
    FOREIGN KEY (tourID) REFERENCES Tour(id)
);

CREATE TABLE Ghost_Buster_Fights_Ghost (
    userID INT,
    ghostID INT,
    PRIMARY KEY (userID, ghostID),
    FOREIGN KEY (userID) REFERENCES Ghost_Buster(userID),
    FOREIGN KEY (ghostID) REFERENCES Ghost(id)
);

---- Populate Tables ----

INSERT INTO User (username, password, email) VALUES 
('spooky_sam', 'hashed_password_123', 'sam@ghosthunters.com'),
('paranormal_pat', 'hashed_password_456', 'pat@spiritwatch.com'),
('ecto_emily', 'hashed_password_789', 'emily@ghostbusters.net'),
('phantom_phil', 'hashed_password_abc', 'phil@hauntedplaces.org'),
('mystic_maya', 'hashed_password_def', 'maya@supernatural.com');

INSERT INTO Ghost_Buster (userID, ghosts_busted, alias) VALUES 
(1, 47, 'The Specter Detector'),
(3, 23, 'Ectoplasm Expert'),
(4, 89, 'Phantom Finder');

INSERT INTO Sighting (visibility, time, userReportID, latitude, longitude) VALUES 
(8, '2024-10-31 23:45:00', 1, 40.7128, -74.0060),
(5, '2024-11-01 02:30:00', 2, 51.5074, -0.1278),
(9, '2024-11-02 00:15:00', 3, 34.0522, -118.2437),
(3, '2024-11-03 03:20:00', 4, 41.8781, -87.6298),
(7, '2024-11-04 01:00:00', 5, 29.7604, -95.3698);

INSERT INTO Ghost (type, name, description, visibility) VALUES 
('Poltergeist', 'The Knocker', 'A mischievous spirit known for rapping on walls and moving objects in abandoned warehouses', 3),
('Apparition', 'Lady Grey', 'A Victorian-era woman in a grey dress, often seen wandering old manors at midnight', 4),
('Shadow Person', 'The Dark Watcher', 'A tall shadowy figure that appears in peripheral vision, particularly in dimly lit corridors', 2),
('Phantom', 'Weeping William', 'The ghost of a sailor who can be heard crying near old docks and harbors', 3),
('Specter', 'The Headless Coachman', 'A headless figure driving a phantom carriage through foggy streets', 5);

INSERT INTO Tour (startTime, endTime, guide, path) VALUES 
('2024-11-15 19:00:00', '2024-11-15 22:00:00', 'Ghostly Gerald', 'Old Town Square -> Haunted Manor -> Cemetery Gates -> Abandoned Hospital'),
('2024-11-16 20:00:00', '2024-11-16 23:00:00', 'Spooky Susan', 'Waterfront Docks -> Colonial Church -> Historic Theater -> Witch Trial Site'),
('2024-11-17 18:30:00', '2024-11-17 21:30:00', 'Creepy Carl', 'Victorian District -> Old Prison -> Haunted Bridge -> Ghost Alley'),
('2024-11-22 19:30:00', '2024-11-22 22:30:00', 'Paranormal Pam', 'Ancient Graveyard -> Cursed Mansion -> Phantom Forest Trail');

INSERT INTO Sighting_Comment (userID, sightingID, reportTime, description) VALUES 
(2, 1, '2024-11-01 10:00:00', 'I saw the same thing in that area last week! Definitely legitimate.'),
(3, 1, '2024-11-01 12:30:00', 'The temperature dropped significantly when I visited this location.'),
(1, 2, '2024-11-01 15:00:00', 'Classic apparition behavior. Well documented sighting.'),
(4, 3, '2024-11-02 09:00:00', 'I captured some EVP recordings near this location around the same time!'),
(5, 4, '2024-11-03 11:00:00', 'This matches historical records of hauntings in this building.');

INSERT INTO Ghost_Comment (userID, ghostID, reportTime, description) VALUES 
(1, 1, '2024-10-25 14:00:00', 'Encountered this entity three times. Very active poltergeist, handles with care.'),
(2, 2, '2024-10-26 16:30:00', 'Lady Grey is a peaceful spirit. She seems to be searching for something.'),
(3, 3, '2024-10-27 11:00:00', 'The Dark Watcher appears most frequently between 2-4 AM. Non-threatening but unsettling.'),
(4, 4, '2024-10-28 13:45:00', 'Heard the weeping near the old harbor. Very melancholic presence.'),
(5, 5, '2024-10-29 10:00:00', 'Historical records confirm sightings of this phantom carriage dating back to 1823.');

INSERT INTO Sighting_Reports_Ghost (sightingID, ghostID) VALUES 
(1, 1),
(1, 3),
(2, 2),
(3, 3),
(4, 4),
(5, 5);

INSERT INTO Tour_Includes (tourID, ghostID) VALUES 
(1, 1),
(1, 2),
(1, 3),
(2, 4),
(2, 2),
(3, 3),
(3, 5),
(4, 1),
(4, 2);

INSERT INTO Tour_Sign_Up (userID, tourID) VALUES 
(1, 1),
(2, 1),
(2, 2),
(3, 3),
(4, 2),
(4, 4),
(5, 1),
(5, 3),
(5, 4);

INSERT INTO Ghost_Buster_Fights_Ghost (userID, ghostID) VALUES 
(1, 1),
(1, 3),
(1, 5),
(3, 2),
(3, 4),
(4, 1),
(4, 2),
(4, 3),
(4, 5);

---- User Input into Database ----
INSERT INTO Sighting (visibility, time, userReportID, latitude, longitude)
VALUES (?, ?, ?, ?, ?);

INSERT INTO Sighting_Reports_Ghost (sightingID, ghostID)
VALUES (newSightingID, ?);

INSERT INTO Sighting_Comment (userID, sightingID, reportTime, description)
VALUES (?, ?, NOW(), ?);

INSERT INTO Ghost_Comment (userID, ghostID, reportTime, description)
VALUES (?, ?, NOW(), ?);

INSERT INTO Tour (startTime, endTime, guide, path)
VALUES (?, ?, ?, ?);

INSERT INTO Tour_Includes (tourID, ghostID)
VALUES (newTourID, ?);

INSERT INTO Tour_Sign_Up (userID, tourID)
VALUES (?, ?);

INSERT INTO Ghost (type, name, description, visibility)
VALUES (?, ?, ?, ?);

---- Update Tables ----

UPDATE User 
SET username = ?, 
    password = ?, 
    email = ?
WHERE id = ?;

UPDATE Ghost_Buster 
SET ghosts_busted = ?, 
    alias = ?
WHERE userID = ?;

UPDATE Sighting 
SET visibility = ?, 
    time = ?, 
    userReportID = ?, 
    latitude = ?, 
    longitude = ?
WHERE id = ?;

UPDATE Ghost 
SET type = ?, 
    name = ?, 
    description = ?
WHERE id = ?;

UPDATE Tour 
SET startTime = ?, 
    endTime = ?, 
    guide = ?, 
    path = ?
WHERE id = ?;

UPDATE Sighting_Comment 
SET reportTime = ?, 
    description = ?
WHERE userID = ? AND sightingID = ?;

UPDATE Ghost_Comment 
SET reportTime = ?, 
    description = ?
WHERE userID = ? AND ghostID = ?;

---- Delete from Tables ----

DELETE FROM Ghost_Buster_Fights_Ghost
WHERE userID = ?;

DELETE FROM Ghost_Buster
WHERE userID = ?;

DELETE FROM Sighting_Comment
WHERE userID = ?;

DELETE FROM Ghost_Comment
WHERE userID = ?;

DELETE FROM Tour_Sign_Up
WHERE userID = ?;

DELETE FROM Sighting_Reports_Ghost
WHERE sightingID IN (SELECT id FROM Sighting WHERE userReportID = ?);

DELETE FROM Sighting_Comment
WHERE sightingID IN (SELECT id FROM Sighting WHERE userReportID = ?);

DELETE FROM Sighting
WHERE userReportID = ?;

DELETE FROM User
WHERE id = ?;

DELETE FROM Sighting_Reports_Ghost
WHERE ghostID = ?;

DELETE FROM Ghost_Comment
WHERE ghostID = ?;

DELETE FROM Tour_Includes
WHERE ghostID = ?;

DELETE FROM Ghost_Buster_Fights_Ghost
WHERE ghostID = ?;

DELETE FROM Ghost
WHERE id = ?;

DELETE FROM Sighting_Comment
WHERE sightingID = ?;

DELETE FROM Sighting_Reports_Ghost
WHERE sightingID = ?;

DELETE FROM Sighting
WHERE id = ?;

DELETE FROM Tour_Sign_Up
WHERE tourID = ?;

DELETE FROM Tour_Includes
WHERE tourID = ?;

DELETE FROM Tour
WHERE id = ?;

DELETE FROM Ghost_Buster_Fights_Ghost
WHERE userID = ?;

DELETE FROM Ghost_Buster
WHERE userID = ?;

---- Advanced Commands ----
ALTER TABLE Tour
ADD CONSTRAINT checkTime
CHECK (startTime < endTime);

DELIMITER $$
CREATE TRIGGER incrementGhostsBustedTrigger
AFTER INSERT ON Ghost_Buster_Fights_Ghost
FOR EACH ROW
	BEGIN
		UPDATE Ghost_Buster
SET ghosts_busted = ghosts_busted + 1
WHERE userID = new.userID;
	END
$$
DELIMITER ;
